/**
 * Pictures chosen on a phone or computer, made ready to send: read reliably, turned the right way up, scaled down, and
 * (for products) fitted whole into a square on white.
 *
 * Reading is done in steps because phones hand over photos in many ways: a photo still in Google Photos arrives only when its
 * bytes are read; a 50-megapixel camera photo can be too big to open at full size on a low-memory phone; the file's type is
 * sometimes missing. So the bytes are read first, the real type comes from the bytes, and the picture is opened already
 * reduced where the browser allows it, with older ways as fall-backs.
 */
type Source = { img: CanvasImageSource; w: number; h: number; done: () => void };

function sniff(b: Uint8Array): string | "heic" | null {
  const at = (i: number, s: string) => [...s].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && at(1, "PNG")) return "image/png";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(0, "GIF8")) return "image/gif";
  if (at(0, "BM")) return "image/bmp";
  if (at(4, "ftyp") && ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].some(t => at(8, t))) return "heic";
  if (at(4, "ftypavif")) return "image/avif";
  return null;
}

async function open(file: File): Promise<Source> {
  if (file.size > 40 * 1024 * 1024) throw new Error("That picture is too large. Choose one under 40 MB.");
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); }
  catch { throw new Error("The phone could not hand over that picture. If it is in Google Photos, wait for it to download, or choose it from Gallery or Files."); }
  const kind = sniff(new Uint8Array(bytes, 0, Math.min(32, bytes.byteLength)));
  if (!kind && file.type && !file.type.startsWith("image/")) throw new Error("That file is not a picture. Choose a photo (JPEG, PNG or WebP).");
  const type = kind && kind !== "heic" ? kind : file.type || "image/jpeg";
  const blob = new Blob([bytes], { type: kind === "heic" ? "image/heic" : type });

  // 1. the browser opens it already reduced and the right way up (saves memory on big camera photos)
  if (typeof createImageBitmap === "function") {
    const big = file.size > 1.5 * 1024 * 1024;
    for (const opts of [big ? { imageOrientation: "from-image", resizeWidth: 1600, resizeQuality: "high" } : { imageOrientation: "from-image" }, {}] as ImageBitmapOptions[]) {
      try { const bm = await createImageBitmap(blob, opts); return { img: bm, w: bm.width, h: bm.height, done: () => bm.close() }; } catch { /* try the next way */ }
    }
  }
  // 2. an ordinary picture element
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch { URL.revokeObjectURL(url); }
  // 3. the same, from the picture's text form
  try {
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = data; });
    return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => undefined };
  } catch { /* fall through */ }
  if (kind === "heic") throw new Error("This photo is in HEIC format, which this browser cannot open. Take a screenshot of the photo and choose the screenshot, or set the camera to save JPEG (Camera settings, Picture formats).");
  throw new Error("That picture could not be opened. Try another photo, or take a screenshot of it and choose the screenshot.");
}

function encode(src: Source, side: number, maxChars: number, square: boolean, keepTransparency: boolean): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const c = document.createElement("canvas"), ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    if (square) {
      // the whole picture, centred on white with a small margin: every product picture has the same shape, nothing is cut off
      const s = Math.min(side, Math.max(src.w, src.h)), pad = Math.round(s * 0.06), room = s - 2 * pad;
      const k = Math.min(room / src.w, room / src.h), w = Math.max(1, Math.round(src.w * k)), h = Math.max(1, Math.round(src.h * k));
      c.width = s; c.height = s; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, s, s);
      ctx.drawImage(src.img, Math.round((s - w) / 2), Math.round((s - h) / 2), w, h);
    } else {
      const k = Math.min(1, side / Math.max(src.w, src.h)), w = Math.max(1, Math.round(src.w * k)), h = Math.max(1, Math.round(src.h * k));
      c.width = w; c.height = h;
      if (!keepTransparency) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(src.img, 0, 0, w, h);
    }
    for (const q of [0.86, 0.74, 0.6]) {
      let out = c.toDataURL("image/webp", q);
      if (!out.startsWith("data:image/webp")) out = keepTransparency ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", q);
      if (out.length <= maxChars) return out;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error("That picture is too detailed to fit. Try a simpler or smaller one.");
}

/**
 * Shrinks a picture before it is sent, so it fits the server's size limit and loads fast: scaled down to `maxSide` pixels and
 * re-encoded (WebP, or PNG for logos that need a clear background). `square` fits it whole into a square on white.
 */
export async function shrinkImage(file: File, opts: { maxSide: number; maxChars: number; keepTransparency?: boolean; square?: boolean }): Promise<string> {
  const src = await open(file);
  try { return encode(src, opts.maxSide, opts.maxChars, !!opts.square, !!opts.keepTransparency); } finally { src.done(); }
}

/** A product's picture and its small copy for lists, from one reading of the file. */
export async function productPictures(file: File): Promise<{ full: string; thumb: string }> {
  const src = await open(file);
  try { return { full: encode(src, 640, 68000, true, false), thumb: encode(src, 128, 13000, true, false) }; } finally { src.done(); }
}

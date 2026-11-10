/** Shrinks a picture in the browser before it is sent, so it fits the server's size limit and loads fast: scaled down to `maxSide` pixels and re-encoded (WebP, or PNG for logos that need a clear background), stepping down until the text form is under `maxChars`. */
/**
 * `square`: the picture is fitted whole into a square on white, centred with a small margin, so every product picture has the
 * same shape in lists and on the counter, whatever size or shape the photo was. Nothing is cut off and nobody has to crop.
 */
export async function shrinkImage(file: File, opts: { maxSide: number; maxChars: number; keepTransparency?: boolean; square?: boolean }): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type)) throw new Error("Choose a PNG, JPEG or WebP picture.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That picture is too large. Choose one under 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file could not be read as a picture.")); i.src = url; });
    let side = opts.maxSide;
    for (let attempt = 0; attempt < 8; attempt++) {
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      if (opts.square) {
        const s = Math.min(side, Math.max(img.naturalWidth, img.naturalHeight)), pad = Math.round(s * 0.06), room = s - 2 * pad;
        const k = Math.min(room / img.naturalWidth, room / img.naturalHeight);
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        c.width = s; c.height = s; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, s, s);
        ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, Math.round((s - w) / 2), Math.round((s - h) / 2), w, h);
      } else {
        const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
        c.width = w; c.height = h;
        if (!opts.keepTransparency) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
      }
      for (const q of [0.86, 0.74, 0.6]) {
        let out = c.toDataURL("image/webp", q);
        if (!out.startsWith("data:image/webp")) out = opts.keepTransparency ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", q);
        if (out.length <= opts.maxChars) return out;
      }
      side = Math.round(side * 0.75);
    }
    throw new Error("That picture is too detailed to fit. Try a simpler or smaller one.");
  } finally { URL.revokeObjectURL(url); }
}

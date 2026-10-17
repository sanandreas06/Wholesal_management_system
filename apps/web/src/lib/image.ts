/** Shrinks a picture in the browser before it is sent, so it fits the server's size limit and loads fast: scaled down to `maxSide` pixels and re-encoded (WebP, or PNG for logos that need a clear background), stepping down until the text form is under `maxChars`. */
export async function shrinkImage(file: File, opts: { maxSide: number; maxChars: number; keepTransparency?: boolean }): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type)) throw new Error("Choose a PNG, JPEG or WebP picture.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That picture is too large. Choose one under 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file could not be read as a picture.")); i.src = url; });
    let side = opts.maxSide;
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      if (!opts.keepTransparency) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
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

import { qrSvg } from "./qr";

/** Code 128 bar widths (bar, space, bar, space, bar, space) for symbol values 0 to 106 (106 = stop, which has a 7th bar). */
const PATTERNS = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");

/** The bars of a Code 128 (set B) barcode for printable ASCII text, as module widths starting with a bar.
 *  Code 128 is read by every 1D USB scanner and by phone cameras, so labels work with the cheapest scanner. */
export function code128Widths(text: string): number[] {
  const values = [104]; // start code B
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error("Code 128 labels take letters, digits and symbols only");
    values.push(c - 32);
  }
  const check = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  values.push(check, 106);
  return values.flatMap((v) => PATTERNS[v].split("").map(Number));
}

/** A Code 128 barcode as an SVG string (black bars, with the quiet zone either side). */
export function code128Svg(text: string, height = 48, module = 2): string {
  const widths = code128Widths(text);
  const quiet = 10;
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  let x = quiet, bars = "";
  widths.forEach((w, i) => { if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${height}"/>`; x += w; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" width="${total * module}" height="${height}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars}</g></svg>`;
}

/** A QR code as an SVG string (for receipts and labels read by a phone camera). */
export function qrSvgString(text: string, size = 120): string {
  const { size: n, path } = qrSvg(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/** An in-store EAN-13 barcode for a product that has none (starts with 2, the range kept for shops' own codes). */
export function makeStoreEan(): string {
  let d = "2" + String(Math.floor(Math.random() * 10));
  for (let i = 0; i < 10; i++) d += String(Math.floor(Math.random() * 10));
  const sum = d.split("").reduce((s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return d + String((10 - (sum % 10)) % 10);
}

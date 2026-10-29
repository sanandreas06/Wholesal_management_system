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

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = L.map(c => c.replace(/./g, b => (b === "0" ? "1" : "0")));
const G = R.map(c => c.split("").reverse().join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export const isEan13 = (c: string) => /^\d{13}$/.test(c) && String((10 - (c.slice(0, 12).split("").reduce((s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3), 0) % 10)) % 10) === c[12];

/** The 95 modules (1 = bar) of an EAN-13 barcode: the retail barcode every scanner, phone camera and ink-jet coder knows. */
export function ean13Modules(code: string): string {
  if (!isEan13(code)) throw new Error("Not a valid EAN-13 code");
  const first = Number(code[0]), left = code.slice(1, 7), right = code.slice(7);
  return "101" + left.split("").map((d, i) => (PARITY[first][i] === "L" ? L : G)[Number(d)]).join("") + "01010" + right.split("").map(d => R[Number(d)]).join("") + "101";
}

/** An EAN-13 barcode as an SVG string, with the guard bars a little longer and the digits underneath. */
export function ean13Svg(code: string, height = 46, withText = true): string {
  const m = ean13Modules(code), quiet = 9, w = 95 + quiet * 2, textH = withText ? 9 : 0, H = height + textH;
  const guard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  let bars = "";
  for (let i = 0; i < 95; i++) if (m[i] === "1") bars += `<rect x="${quiet + i}" y="0" width="1" height="${guard(i) && withText ? height + 4 : height}"/>`;
  const t = withText ? `<g font-family="monospace" font-size="9" text-anchor="middle" fill="#000"><text x="${quiet - 4}" y="${H - 1}">${code[0]}</text><text x="${quiet + 3 + 21}" y="${H - 1}" letter-spacing="1.3">${code.slice(1, 7)}</text><text x="${quiet + 50 + 21}" y="${H - 1}" letter-spacing="1.3">${code.slice(7)}</text></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H}" width="${w * 2}" height="${H * 2}" shape-rendering="crispEdges" aria-hidden="true"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars}</g>${t}</svg>`;
}

/** The right barcode for a code: EAN-13 for product codes, Code 128 for everything else (item labels, invoice numbers). */
export function barcodeSvg(code: string, height = 46): string {
  return isEan13(code) ? ean13Svg(code, height) : code128Svg(code, height);
}

/** What a WHOLESTRA "finding" QR holds: an address that opens the item or product in WHOLESTRA when a phone camera reads it. */
export function findUrl(code: string, origin = typeof window === "undefined" ? "" : window.location.origin) {
  return `${origin}/f/${encodeURIComponent(code)}`;
}

/** A scanned WHOLESTRA QR holds an address (…/f/<code>); this gives back the code. Anything else is returned as read. */
export function codeFromScan(raw: string): string {
  const s = (raw ?? "").trim();
  const m = s.match(/^https?:\/\/[^/\s]+(?:\/w\/[a-z0-9-]+)?\/f\/([^/?#\s]{3,64})\/?$/i);
  return m ? decodeURIComponent(m[1]) : s;
}

/** An in-store EAN-13 barcode for a product that has none (starts with 2, the range kept for shops' own codes). */
export function makeStoreEan(): string {
  let d = "2" + String(Math.floor(Math.random() * 10));
  for (let i = 0; i < 10; i++) d += String(Math.floor(Math.random() * 10));
  const sum = d.split("").reduce((s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return d + String((10 - (sum % 10)) % 10);
}

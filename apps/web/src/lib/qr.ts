import qrcode from "qrcode-generator";

/** Turns text (the authenticator link) into an SVG path of dark squares, drawn on a white square so phone cameras read it in dark mode too. */
export function qrSvg(text: string) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), quiet = 4, size = n + quiet * 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return { size, path: d };
}

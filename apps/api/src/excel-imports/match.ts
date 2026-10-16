/** Lower-case, strip accents and punctuation, collapse spaces: "Coca-Cola  330ml." -> "coca cola 330ml". */
export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/ /g, "");
  for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); }
  return m;
}

/** 0..1 closeness of two names: Dice score on letter pairs, boosted when one contains all the words of the other. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a), y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bx = bigrams(x), by = bigrams(y);
  let overlap = 0, nx = 0, ny = 0;
  for (const [g, c] of bx) { nx += c; overlap += Math.min(c, by.get(g) ?? 0); }
  for (const c of by.values()) ny += c;
  const dice = nx + ny === 0 ? 0 : (2 * overlap) / (nx + ny);
  const tx = new Set(x.split(" ")), ty = new Set(y.split(" "));
  const small = tx.size <= ty.size ? tx : ty, big = tx.size <= ty.size ? ty : tx;
  const contained = [...small].every(w => big.has(w));
  return contained ? Math.max(dice, 0.8) : dice;
}

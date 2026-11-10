import { ALL_CATEGORIES } from "./catalog";

/**
 * Suggests a category and a brand from a product's name as it is typed, inside the app (no outside service, works offline):
 * 1. a brand name in the product's name ("Air Wick Reed Diffuser" -> Air Wick), from the ready-made list or the company's own brands;
 * 2. words that point to a category ("diffuser", "engine oil", "rice"), longer phrases counting more;
 * 3. what the company itself did before: names sharing words with products already filed under a category lean towards it.
 */
export interface Past { name: string; category?: string | null; brand?: string | null }
export interface Suggestion { category: string | null; brand: string | null; sure: boolean }

const norm = (s: string) => ` ${s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()} `;
// a light "same word" test: diffusers ~ diffuser, tyres ~ tyre, batteries ~ battery
const stem = (w: string) => w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("es") && /(ss|sh|ch|x)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
const stemmed = (s: string) => ` ${norm(s).trim().split(" ").map(stem).join(" ")} `;
const STOP = new Set(["the", "and", "for", "with", "pack", "pcs", "pc", "piece", "pieces", "set", "new", "big", "small", "medium", "large", "box", "carton", "bag", "of", "in", "x"]);
const isQty = (w: string) => /^\d/.test(w) || /^(kg|g|ml|l|ltr|litre|liter|cl|oz|lb|cm|mm|inch|v|w|mah)$/.test(w);

interface Index { words: { cat: string; phrase: string; weight: number }[]; brands: { brand: string; key: string; cats: string[] }[] }
let built: Index | null = null;
function index(): Index {
  if (built) return built;
  const words: Index["words"] = [];
  const brandCats = new Map<string, Set<string>>();
  for (const c of ALL_CATEGORIES) {
    for (const w of [...c.words, c.name.replace(/\(.*?\)/g, "")]) {
      const phrase = stemmed(w);
      if (phrase.trim().length < 2) continue;
      const n = phrase.trim().split(" ").length;
      words.push({ cat: c.name, phrase, weight: w === c.name ? 1.5 : n > 1 ? 3 + n : 2 });
    }
    for (const b of c.brands) { const s = brandCats.get(b) ?? new Set(); s.add(c.name); brandCats.set(b, s); }
  }
  const brands = [...brandCats].map(([brand, cats]) => ({ brand, key: norm(brand), cats: [...cats] }));
  return (built = { words, brands });
}

export function suggest(name: string, past: Past[] = [], ownBrands: string[] = []): Suggestion {
  const n = norm(name), s = stemmed(name);
  if (n.trim().length < 3) return { category: null, brand: null, sure: false };
  const { words, brands } = index();
  const score = new Map<string, number>();
  const add = (cat: string, v: number) => score.set(cat, (score.get(cat) ?? 0) + v);

  // 1. a brand named in the product's name (the longest one wins: "Malta Guinness" before "Guinness")
  const allBrands = [...brands, ...ownBrands.filter(b => !brands.some(x => x.key === norm(b))).map(b => ({ brand: b, key: norm(b), cats: [] as string[] }))];
  const brandHit = allBrands.filter(b => b.key.trim().length >= 2 && n.includes(b.key)).sort((a, b) => b.key.length - a.key.length)[0];
  // a brand sold in only one category is a strong hint on its own (Hennessy -> Wines & Spirits)
  if (brandHit) for (const c of brandHit.cats) add(c, brandHit.cats.length === 1 ? 2.5 : 1.5);

  // 2. words and phrases that point to a category
  // the thing a name is about usually comes last ("PlayStation 5 Controller" is a controller, "Phone Case" a case): that word counts a bit more
  let last: { cat: string; end: number } | null = null;
  for (const w of words) {
    const at = s.lastIndexOf(w.phrase);
    if (at < 0) continue;
    add(w.cat, w.weight);
    const end = at + w.phrase.length;
    if (!last || end > last.end) last = { cat: w.cat, end };
  }
  if (last) add(last.cat, 1.5);

  // 3. what the company filed before: shared words, and the same brand
  const tokens = [...new Set(s.trim().split(" ").filter(w => w.length >= 3 && !STOP.has(w) && !isQty(w)))];
  if (past.length) {
    const seen = new Map<string, Map<string, number>>();
    for (const p of past) {
      if (!p.category) continue;
      const pt = new Set(stemmed(p.name).trim().split(" "));
      for (const t of tokens) if (pt.has(t)) { const m = seen.get(t) ?? new Map(); m.set(p.category, (m.get(p.category) ?? 0) + 1); seen.set(t, m); }
      if (brandHit && p.brand && norm(p.brand) === brandHit.key) add(p.category, 1);
    }
    for (const [, m] of seen) { const total = [...m.values()].reduce((a, b) => a + b, 0); for (const [cat, k] of m) add(cat, 2.5 * k / total); }
  }

  const ranked = [...score].sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  const category = best && best[1] >= 2 ? best[0] : null;
  return { category, brand: brandHit?.brand ?? null, sure: !!category && (!second || best[1] - second[1] >= 1.5) };
}

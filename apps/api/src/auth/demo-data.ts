/** Sample company for the public demo. Every name, number and price here is made up; nothing in it describes a real business. */

export const DEMO_EMAIL = "demo@wholestra.example";
export const DEMO_COMPANY = "Demo Wholesale Ltd";

/** Tiny flat pictures, drawn here so the demo needs no image files. */
const GLYPH: Record<string, string> = {
  bag: '<path d="M30 34h36l6 44a6 6 0 0 1-6 7H30a6 6 0 0 1-6-7z" fill="#fff" opacity=".95"/><path d="M36 34c0-9 4-14 12-14s12 5 12 14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><rect x="34" y="50" width="28" height="16" rx="4" fill="currentColor" opacity=".35"/>',
  can: '<ellipse cx="48" cy="28" rx="20" ry="8" fill="#fff"/><path d="M28 28v40c0 4.4 9 8 20 8s20-3.6 20-8V28c0 4.4-9 8-20 8s-20-3.6-20-8z" fill="#fff" opacity=".95"/><rect x="28" y="44" width="40" height="14" fill="currentColor" opacity=".35"/>',
  box: '<path d="M48 20l26 12v32L48 76 22 64V32z" fill="#fff" opacity=".95"/><path d="M22 32l26 12 26-12M48 44v32" fill="none" stroke="currentColor" stroke-width="4" opacity=".4"/>',
  pipe: '<rect x="14" y="36" width="68" height="24" rx="6" fill="#fff" opacity=".95"/><rect x="22" y="31" width="9" height="34" rx="3" fill="#fff"/><rect x="65" y="31" width="9" height="34" rx="3" fill="#fff"/>',
  bucket: '<path d="M24 34h48l-6 44H30z" fill="#fff" opacity=".95"/><ellipse cx="48" cy="34" rx="24" ry="7" fill="#fff"/><path d="M30 24c4-12 32-12 36 0" fill="none" stroke="#fff" stroke-width="4"/><rect x="34" y="48" width="28" height="14" rx="3" fill="currentColor" opacity=".35"/>',
  bottle: '<rect x="40" y="16" width="16" height="12" rx="3" fill="#fff"/><path d="M38 28h20c8 6 10 12 10 20v28a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V48c0-8 2-14 10-20z" fill="#fff" opacity=".95"/><rect x="32" y="50" width="32" height="16" rx="3" fill="currentColor" opacity=".35"/>',
  rod: '<rect x="14" y="30" width="68" height="7" rx="3" fill="#fff"/><rect x="14" y="44" width="68" height="7" rx="3" fill="#fff" opacity=".9"/><rect x="14" y="58" width="68" height="7" rx="3" fill="#fff" opacity=".8"/>',
  nails: '<path d="M30 26h20v6l-4 4v36l-6 8-6-8V36l-4-4z" fill="#fff"/><path d="M52 34h16v5l-3 3v28l-5 7-5-7V42l-3-3z" fill="#fff" opacity=".85"/>',
};
export function tile(kind: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" color="${color}"><rect width="96" height="96" rx="18" fill="${color}"/>${GLYPH[kind] ?? GLYPH.box}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export interface DemoProduct { sku: string; name: string; category: string; unit: string; price: number; cost: number; reorder: number; open: [number, number, number]; glyph: string; color: string; weight: number }
// open = opening stock at Accra, Kumasi, Tema
export const PRODUCTS: DemoProduct[] = [
  { sku: "RICE-25", name: "Perfumed rice 25kg", category: "Foodstuff", unit: "BAG", price: 520, cost: 455, reorder: 30, open: [220, 160, 140], glyph: "bag", color: "#2563EB", weight: 9 },
  { sku: "SUGAR-50", name: "Sugar 50kg", category: "Foodstuff", unit: "BAG", price: 610, cost: 548, reorder: 20, open: [90, 70, 60], glyph: "bag", color: "#0EA5A4", weight: 5 },
  { sku: "FLOUR-50", name: "Wheat flour 50kg", category: "Foodstuff", unit: "BAG", price: 495, cost: 430, reorder: 20, open: [100, 80, 70], glyph: "bag", color: "#C97A2E", weight: 5 },
  { sku: "OIL-25", name: "Vegetable oil 25L", category: "Foodstuff", unit: "PCS", price: 690, cost: 610, reorder: 15, open: [70, 55, 50], glyph: "can", color: "#D97706", weight: 6 },
  { sku: "TOM-CTN", name: "Tomato paste carton", category: "Foodstuff", unit: "CTN", price: 215, cost: 176, reorder: 25, open: [120, 90, 80], glyph: "box", color: "#DC2626", weight: 6 },
  { sku: "WATER-30", name: "Bottled water 30-pack", category: "Beverages", unit: "PACK", price: 58, cost: 44, reorder: 60, open: [400, 300, 260], glyph: "bottle", color: "#0284C7", weight: 10 },
  { sku: "CEM-50", name: "Cement 50kg", category: "Building materials", unit: "BAG", price: 98, cost: 87, reorder: 80, open: [520, 380, 300], glyph: "bag", color: "#475569", weight: 14 },
  { sku: "ROD-12", name: "Iron rod 12mm", category: "Building materials", unit: "PCS", price: 118, cost: 101, reorder: 60, open: [300, 240, 200], glyph: "rod", color: "#7C3AED", weight: 6 },
  { sku: "NAIL-3", name: "Roofing nails 3in (1kg)", category: "Building materials", unit: "KG", price: 24, cost: 17, reorder: 50, open: [260, 200, 160], glyph: "nails", color: "#B45309", weight: 5 },
  { sku: "PAINT-20", name: "Emulsion paint 20L", category: "Building materials", unit: "PCS", price: 640, cost: 560, reorder: 12, open: [48, 40, 36], glyph: "bucket", color: "#16A34A", weight: 4 },
  { sku: "PVC-4", name: "PVC pipe 4in", category: "Building materials", unit: "PCS", price: 86, cost: 70, reorder: 40, open: [180, 140, 120], glyph: "pipe", color: "#0F766E", weight: 4 },
  { sku: "SOAP-CTN", name: "Laundry soap carton", category: "Household", unit: "CTN", price: 165, cost: 132, reorder: 25, open: [110, 85, 70], glyph: "box", color: "#DB2777", weight: 5 },
];

/** Stock pushed to a chosen level at the end, so the demo shows an out-of-stock item and a few low ones. */
export const FINAL_STOCK: { sku: string; branch: number; qty: number }[] = [
  { sku: "CEM-50", branch: 2, qty: 0 },
  { sku: "NAIL-3", branch: 0, qty: 12 },
  { sku: "OIL-25", branch: 1, qty: 6 },
  { sku: "PAINT-20", branch: 2, qty: 5 },
  { sku: "SUGAR-50", branch: 0, qty: 14 },
];

export const BRANCHES = [{ name: "Accra", code: "ACC-001", location: "Accra" }, { name: "Kumasi", code: "KSI-001", location: "Kumasi" }, { name: "Tema", code: "TEM-001", location: "Tema" }];
export const CUSTOMERS = ["Adom Provisions", "Nana Yaa Stores", "Golden Gate Supplies", "Kasoa Mini Mart", "Obuasi Builders Ltd", "Sakumono Hardware", "Mama Efua Catering", "Tamale Traders", "Ho Central Shop", "Cape Coast Depot"];
export const SUPPLIERS = ["Tema Flour Mills (sample)", "Gold Coast Sugar Importers (sample)", "Ashanti Steel Works (sample)", "Volta Paints Ltd (sample)"];
export const STAFF = [{ name: "Ama Owusu", email: "ama@demo.wholestra.example", role: "BRANCH_MANAGER", branch: 0 }, { name: "Kofi Mensah", email: "kofi@demo.wholestra.example", role: "INVENTORY_USER", branch: 1 }, { name: "Efua Quaye", email: "efua@demo.wholestra.example", role: "SALES_USER", branch: 2 }];

/** Small repeatable random numbers, so the demo looks the same every time it is rebuilt. */
export function rng(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

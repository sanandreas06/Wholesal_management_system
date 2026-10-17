/** Choices for the company profile (set-up screen and Settings → Organization profile). Currencies match the server's list. */

export const INDUSTRIES = [
  "General wholesale and distribution", "Building materials and hardware", "Food and beverages", "Fast-moving consumer goods (FMCG)", "Pharmaceuticals and medical supplies",
  "Electronics and phones", "Clothing, textiles and shoes", "Cosmetics and beauty", "Agriculture and agro-inputs", "Auto parts", "Stationery and office supplies", "Other",
];

type Country = { name: string; currency: string; zone: string; regions?: string[] };
export const COUNTRIES: Country[] = [
  { name: "Ghana", currency: "GHS", zone: "Africa/Accra", regions: ["Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra", "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"] },
  { name: "Nigeria", currency: "NGN", zone: "Africa/Lagos" },
  { name: "Côte d'Ivoire", currency: "XOF", zone: "Africa/Abidjan" },
  { name: "Togo", currency: "XOF", zone: "Africa/Lome" },
  { name: "Benin", currency: "XOF", zone: "Africa/Porto-Novo" },
  { name: "Burkina Faso", currency: "XOF", zone: "Africa/Ouagadougou" },
  { name: "Senegal", currency: "XOF", zone: "Africa/Dakar" },
  { name: "Mali", currency: "XOF", zone: "Africa/Bamako" },
  { name: "Cameroon", currency: "XAF", zone: "Africa/Douala" },
  { name: "Kenya", currency: "KES", zone: "Africa/Nairobi" },
  { name: "Uganda", currency: "UGX", zone: "Africa/Kampala" },
  { name: "Tanzania", currency: "TZS", zone: "Africa/Dar_es_Salaam" },
  { name: "Rwanda", currency: "RWF", zone: "Africa/Kigali" },
  { name: "Zambia", currency: "ZMW", zone: "Africa/Lusaka" },
  { name: "South Africa", currency: "ZAR", zone: "Africa/Johannesburg" },
  { name: "Egypt", currency: "EGP", zone: "Africa/Cairo" },
  { name: "Morocco", currency: "MAD", zone: "Africa/Casablanca" },
  { name: "United Kingdom", currency: "GBP", zone: "Europe/London" },
  { name: "United States", currency: "USD", zone: "America/New_York" },
  { name: "Canada", currency: "CAD", zone: "America/Toronto" },
  { name: "Germany", currency: "EUR", zone: "Europe/Berlin" },
  { name: "France", currency: "EUR", zone: "Europe/Paris" },
  { name: "Netherlands", currency: "EUR", zone: "Europe/Amsterdam" },
  { name: "United Arab Emirates", currency: "AED", zone: "Asia/Dubai" },
  { name: "India", currency: "INR", zone: "Asia/Kolkata" },
  { name: "China", currency: "CNY", zone: "Asia/Shanghai" },
  { name: "Australia", currency: "AUD", zone: "Australia/Sydney" },
];

export const CURRENCIES: [string, string][] = [
  ["GHS", "Ghanaian cedi"], ["NGN", "Nigerian naira"], ["USD", "US dollar"], ["EUR", "Euro"], ["GBP", "British pound"], ["XOF", "West African CFA franc"], ["XAF", "Central African CFA franc"],
  ["KES", "Kenyan shilling"], ["UGX", "Ugandan shilling"], ["TZS", "Tanzanian shilling"], ["ZAR", "South African rand"], ["RWF", "Rwandan franc"], ["ZMW", "Zambian kwacha"], ["EGP", "Egyptian pound"],
  ["MAD", "Moroccan dirham"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"], ["INR", "Indian rupee"], ["CNY", "Chinese yuan"], ["AED", "UAE dirham"],
];

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const LANGUAGES: [string, string][] = [["en", "English"]];

/** Every time zone the browser knows, with the common West African ones first. */
export function timeZones(): string[] {
  const first = ["Africa/Accra", "Africa/Lagos", "Africa/Abidjan", "Africa/Nairobi", "Africa/Johannesburg", "Europe/London", "UTC"];
  let all: string[] = [];
  try { all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch { /* old browser */ }
  if (!all.length) all = [...new Set([...first, ...COUNTRIES.map((c) => c.zone)])];
  return [...first.filter((z) => z === "UTC" || all.includes(z)), ...all.filter((z) => !first.includes(z))];
}

export const countryInfo = (name: string) => COUNTRIES.find((c) => c.name === name);
export const today = () => new Date().toISOString().slice(0, 10);

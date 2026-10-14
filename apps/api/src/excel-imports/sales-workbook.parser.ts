import { BadRequestException } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { Readable } from "stream";

export interface ParsedRow {
  rowNumber: number;
  date: string | null;      // YYYY-MM-DD, null when unreadable
  rawDate: string;
  sku: string;
  product: string;
  quantity: number | null;
  rawQuantity: string;
  unitPrice: number | null; // null = blank, use catalogue price
  rawPrice: string;
  reference: string;
  raw: string;
}

export const MAX_ROWS = 5000;

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "sale date", "sold on", "day"],
  sku: ["sku", "product code", "code", "item code"],
  product: ["product", "product name", "item", "item name", "description"],
  quantity: ["quantity", "qty", "units", "quantity sold"],
  price: ["unit price", "price", "selling price", "unit cost"],
  reference: ["reference", "ref", "invoice", "receipt", "receipt no"]
};

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as any;
    if (o.result !== undefined) return cellText(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.error) return String(o.error);
  }
  return String(v).trim();
}

export function normalizeDate(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const t = cellText(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function toNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  const t = cellText(v).replace(/,/g, "");
  if (t === "") return null;
  const n = Number(t);
  return isNaN(n) ? NaN : n;
}

export async function parseSalesWorkbook(buffer: Buffer, fileName: string): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  const lower = fileName.toLowerCase();
  try {
    if (lower.endsWith(".csv")) await wb.csv.read(Readable.from(buffer));
    else await wb.xlsx.load(buffer as any);
  } catch {
    throw new BadRequestException("The file could not be read. Upload a valid .xlsx or .csv file.");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new BadRequestException("The workbook has no sheets");

  const headerRow = ws.getRow(1);
  const col: Record<string, number> = {};
  headerRow.eachCell((cell, n) => {
    const h = cellText(cell.value).toLowerCase();
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) if (aliases.includes(h) && !col[key]) col[key] = n;
  });
  const missing: string[] = [];
  if (!col.date) missing.push("Date");
  if (!col.quantity) missing.push("Quantity");
  if (!col.sku && !col.product) missing.push("SKU or Product");
  if (missing.length) throw new BadRequestException(`Missing required column(s): ${missing.join(", ")}. The first row must contain headers (download the template).`);

  const rows: ParsedRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k: string) => (col[k] ? row.getCell(col[k]).value : null);
    const blank = ["date", "sku", "product", "quantity", "price", "reference"].every(k => cellText(get(k)) === "");
    if (blank) continue;
    if (rows.length >= MAX_ROWS) throw new BadRequestException(`Too many rows: a single import is limited to ${MAX_ROWS} rows`);
    const q = toNumber(get("quantity"));
    const p = toNumber(get("price"));
    rows.push({
      rowNumber: r,
      date: normalizeDate(get("date")), rawDate: cellText(get("date")),
      sku: cellText(get("sku")), product: cellText(get("product")),
      quantity: q === null || isNaN(q) ? null : q, rawQuantity: cellText(get("quantity")),
      unitPrice: p === null || isNaN(p) ? null : p, rawPrice: cellText(get("price")),
      reference: cellText(get("reference")),
      raw: [cellText(get("date")), cellText(get("sku")), cellText(get("product")), cellText(get("quantity")), cellText(get("price"))].join(" | ")
    });
  }
  return rows;
}

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Weekly Sales");
  ws.columns = [
    { header: "Date", key: "date", width: 14 }, { header: "SKU", key: "sku", width: 14 }, { header: "Product", key: "product", width: 30 },
    { header: "Quantity", key: "qty", width: 10 }, { header: "Unit Price", key: "price", width: 12 }, { header: "Reference", key: "ref", width: 16 }
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ date: "2026-10-12", sku: "RICE-001", product: "Premium Rice 25kg", qty: 5, price: 280, ref: "" });
  const notes = wb.addWorksheet("Instructions");
  [
    "One row per product sold per day. Keep the header row exactly as is.",
    "Date: YYYY-MM-DD (or DD/MM/YYYY). Must fall inside the period you choose when uploading.",
    "SKU or Product: at least one is required. SKU is matched first, then the exact product name.",
    "Quantity: whole number greater than zero.",
    "Unit Price: optional. If left blank the catalogue selling price is used.",
    "Reference: optional receipt/invoice number. Two otherwise identical rows are only treated as separate sales if they appear twice in the same file.",
    "Uploading the same rows again is safe: duplicates are detected and skipped."
  ].forEach(t => notes.addRow([t]));
  notes.getColumn(1).width = 110;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

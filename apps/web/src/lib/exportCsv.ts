import { toast } from "./toast";

export interface CsvColumn<T> { header: string; value: (row: T) => string | number | null | undefined }

/** Downloads rows as a CSV file that opens cleanly in Excel (UTF-8 with a byte-order mark). */
export function exportCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // a leading = + - @ can be run as a formula when the file is opened in a spreadsheet
    const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map(c => esc(c.header)).join(","), ...rows.map(r => columns.map(c => esc(c.value(r))).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to ${a.download}`);
}

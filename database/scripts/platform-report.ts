/**
 * Prints the WHOLESTRA platform report (companies, accounts, emails, inquiries).
 * Read-only. Run against whichever database DATABASE_URL points to:
 *   pnpm db:report
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const lines = readFileSync(join(__dirname, "platform-report.sql"), "utf8").split(/\r?\n/);
  let sql = "";
  for (const line of lines) {
    const echo = line.match(/^\\echo\s+'(.*)'/);
    if (echo) { if (echo[1]) console.log(`\n${echo[1]}`); continue; }
    if (line.trim().startsWith("--")) continue;
    sql += line + "\n";
    if (line.trim().endsWith(";")) {
      const rows = (await prisma.$queryRawUnsafe(sql.trim().replace(/;$/, ""))) as Record<string, unknown>[];
      const clean = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])));
      clean.length ? console.table(clean) : console.log("(none)");
      sql = "";
    }
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());

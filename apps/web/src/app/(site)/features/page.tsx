import type { Metadata } from "next";
import Link from "next/link";
import { StockMock, SaleMock, ApprovalMock, ImportMock, RolesMock, SealMock, InsightMock } from "../../../components/landing/Mockups";

export const metadata: Metadata = { title: "Features | WHOLESTRA", description: "Products, inventory, sales, purchasing, finance, Excel import, roles, a sealed change log and insights for multi-branch wholesalers." };

const AREAS = [
  { id: "inventory", h: "Inventory across branches", p: "Every branch has its own stock. Every movement is recorded, so you can always see how a number got there.", pts: ["Stock per branch, with Out, Low and OK labels", "Transfers that go from draft to approved, sent and received", "Stock counts and adjustments that always ask for a reason, and never go below zero"], Mock: StockMock },
  { id: "sales", h: "Sales and customers", p: "Write an invoice with live stock for the branch. Take payment by cash, bank, mobile money or credit.", pts: ["Several payments on one invoice", "Credit limits checked against each customer’s balance", "Returns and voids put stock back"], Mock: SaleMock },
  { id: "purchasing", h: "Purchasing and receiving", p: "Order from suppliers and receive goods in parts. Cost updates automatically when stock arrives.", pts: ["Purchase orders from draft to fully received", "Partial receiving checked against what was ordered", "Weighted-average cost kept up to date"], Mock: InsightMock },
  { id: "finance", h: "Expenses and approvals", p: "Record expenses per branch and send them to the right person. Roles can have a limit on what they may approve.", pts: ["Anything above a manager’s limit waits for the owner", "Nobody approves their own expense", "Deposits, and cases opened when the numbers do not match"], Mock: ApprovalMock },
  { id: "import", h: "Excel and CSV import", p: "Bring in sales from spreadsheets by branch and period. Rows already imported are not counted twice.", pts: ["Products matched by SKU, name or alias", "Unknown names are listed for you to review", "Import history you can open and check"], Mock: ImportMock },
  { id: "people", h: "People and roles", p: "Give each person a role and a branch. A branch manager sees their own branch and nothing else.", pts: ["Profit and cost price shown only to roles that may see them", "New users choose their own password on first sign-in", "Roles you can edit as the business grows"], Mock: RolesMock },
  { id: "log", h: "A sealed change log", p: "Changes to prices, stock, users and approvals are written to a log that shows if anyone tampers with it.", pts: ["Before and after values for each change", "Sign-ins shown in plain words: the device and where from", "A clear “the log is intact” check"], Mock: SealMock },
  { id: "insights", h: "Insights and alerts", p: "Trends, best sellers, and money tied up in slow stock. Reorder suggestions come from how fast each product sells.", pts: ["Press Ctrl+K to jump to any page or record", "Notifications for things that need a decision", "Light and dark themes, and a menu that works on phones"], Mock: InsightMock },
];

export default function Features() {
  return (
    <>
      <section className="lp-page-hero"><div className="lp-wrap"><h1>What WHOLESTRA does</h1><p className="lp-lead">One system for the whole wholesale day, from the order you place with a supplier to the expense a manager approves.</p></div></section>
      {AREAS.map((a, i) => (
        <section key={a.id} id={a.id} className={"lp-sec " + (i % 2 ? "tint" : "light")}>
          <div className={"lp-wrap lp-split" + (i % 2 ? " flip" : "")}>
            <div>
              <h2 className="lp-h2">{a.h}</h2>
              <p className="lp-sub">{a.p}</p>
              <ul className="lp-ticks">{a.pts.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <a.Mock />
          </div>
        </section>
      ))}
      <section className="lp-final"><div className="lp-wrap"><h2 className="lp-h2">Want to see it with your own products?</h2><div className="lp-cta center"><Link href="/get-started" className="lp-btn kraft">Get started</Link><Link href="/contact" className="lp-btn line">Ask a question</Link></div></div></section>
    </>
  );
}

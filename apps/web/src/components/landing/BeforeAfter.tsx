'use client';
import { useState } from "react";

const ROWS = [
  { topic: "Stock", before: "Phone each branch to ask what is left.", after: "Every branch’s stock, live, on one screen." },
  { topic: "Expenses", before: "Receipts in a drawer, approved by whoever is around.", after: "Each expense waits for the right person, within the limit you set." },
  { topic: "Price changes", before: "A price changed. Nobody can say who did it.", after: "Every change is logged with who, when, and from which device." },
  { topic: "Reordering", before: "You find out about an empty shelf when a customer asks.", after: "Reorder suggestions based on how fast each product sells." },
  { topic: "Sales history", before: "Retype last week’s sales from paper.", after: "Import Excel or CSV by branch and period." },
];

export default function BeforeAfter() {
  const [mode, setMode] = useState<"before" | "after">("before");
  return (
    <div className="ba">
      <div className="ba-switch" role="group" aria-label="Compare">
        <button type="button" aria-pressed={mode === "before"} onClick={() => setMode("before")}>Today</button>
        <button type="button" aria-pressed={mode === "after"} onClick={() => setMode("after")}>With WHOLESTRA</button>
      </div>
      <dl className={"ba-list " + mode} key={mode}>
        {ROWS.map((r) => (<div key={r.topic}><dt>{r.topic}</dt><dd>{mode === "before" ? r.before : r.after}</dd></div>))}
      </dl>
    </div>
  );
}

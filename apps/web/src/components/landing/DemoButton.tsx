'use client';
import { useState } from "react";
import DemoModal from "./DemoModal";

/** "Try the demo": asks for the visitor's shop or company name in a pop-up, then opens the shared, read-only sample company. */
export default function DemoButton({ className = "lp-btn line", label = "Try the demo" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      <DemoModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

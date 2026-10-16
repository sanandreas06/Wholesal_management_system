'use client';
import { useEffect, useState } from "react";
import { toast, ToastItem } from "../lib/toast";

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => toast.subscribe(t => {
    setItems(prev => [...prev.slice(-3), t]);
    setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), t.kind === "error" ? 7000 : 4000);
  }), []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={"toast " + t.kind}>
          <span className="toast-ic">{t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}</span>
          <span>{t.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}>&times;</button>
        </div>
      ))}
    </div>
  );
}

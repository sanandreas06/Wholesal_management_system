'use client';
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "wms_referbar_closed";

/** A thin strip above the top bar on every public page: refer a company and earn up to US$30. It can be closed, and stays closed in this browser. */
export default function ReferBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem(KEY) !== "1"); } catch { setOpen(true); } }, []);
  if (!open) return null;
  return (
    <div className="lp-refbar" role="region" aria-label="Refer and earn">
      <span className="lp-refbar-gift" aria-hidden="true">🎁</span>
      <p><b>Refer & earn:</b> introduce a business to WHOLESTRA and earn up to <b>US$30</b> when it joins.</p>
      <Link href="/refer">How it works →</Link>
      <button type="button" aria-label="Close" onClick={() => { setOpen(false); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } }}>×</button>
    </div>
  );
}

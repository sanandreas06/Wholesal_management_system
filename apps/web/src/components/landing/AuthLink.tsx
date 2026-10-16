'use client';
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSessionUser } from "../../lib/session";

/** "Sign in" for visitors; "Open dashboard" for someone who is already signed in. Also applies the theme the person chose inside the app. */
export default function AuthLink({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(!!getSessionUser());
    try { const t = localStorage.getItem("wms_theme"); if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t); } catch { /* storage unavailable */ }
  }, []);
  return <Link href={signedIn ? "/dashboard" : "/login"} className={className}>{signedIn ? "Open dashboard" : children ?? "Sign in"}</Link>;
}

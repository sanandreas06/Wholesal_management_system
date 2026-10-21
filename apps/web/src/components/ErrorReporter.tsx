'use client';
import { useEffect } from "react";
import { reportError } from "../lib/report";

/** Catches errors that nothing else handled, anywhere on the website, and sends them to the Platform monitor. */
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => reportError(ev.error ?? ev.message);
    const onRejection = (ev: PromiseRejectionEvent) => reportError(ev.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}

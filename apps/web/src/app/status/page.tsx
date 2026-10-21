import type { Metadata } from "next";
import { Suspense } from "react";
import SystemChecks from "../../components/SystemChecks";

export const metadata: Metadata = { title: "System checks | WHOLESTRA", robots: { index: false } };
export default function Status() { return <Suspense><SystemChecks /></Suspense>; }

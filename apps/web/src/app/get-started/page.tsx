import type { Metadata } from "next";
import { Suspense } from "react";
import SignUpFlow from "../../components/auth/SignUpFlow";

export const metadata: Metadata = { title: "Create your account | WHOLESTRA", description: "Create a WHOLESTRA account with your email, Google, Facebook or LinkedIn, and set up your company in a few minutes." };
export default function GetStarted() { return <Suspense><SignUpFlow /></Suspense>; }

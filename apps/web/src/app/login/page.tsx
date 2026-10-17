import type { Metadata } from "next";
import { Suspense } from "react";
import SignInFlow from "../../components/auth/SignInFlow";

export const metadata: Metadata = { title: "Sign in | WHOLESTRA", description: "Sign in to your WHOLESTRA account." };
export default function Login() { return <Suspense><SignInFlow /></Suspense>; }

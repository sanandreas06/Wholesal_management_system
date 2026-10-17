import type { Metadata } from "next";
import OAuthComplete from "../../../components/auth/OAuthComplete";

export const metadata: Metadata = { title: "Signing in | WHOLESTRA", robots: { index: false } };
export default function Complete() { return <OAuthComplete />; }

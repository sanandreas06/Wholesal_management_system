import type { Metadata } from "next";
import ReleaseNote from "../../components/scan/ReleaseNote";

export const metadata: Metadata = { title: "Release note | WHOLESTRA", robots: { index: false } };
export default function ReleaseNotePage() { return <ReleaseNote />; }

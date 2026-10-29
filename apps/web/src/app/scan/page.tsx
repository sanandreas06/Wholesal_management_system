import type { Metadata } from "next";
import ScanHub from "../../components/scan/ScanHub";

export const metadata: Metadata = { title: "Scan | WHOLESTRA", robots: { index: false } };
export default function ScanPage() { return <ScanHub />; }

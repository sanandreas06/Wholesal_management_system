import type { Metadata } from "next";
import StickScan from "../../../components/scan/StickScan";

export const metadata: Metadata = { title: "Stick and scan labels | WHOLESTRA", robots: { index: false } };
export default function StickScanPage() { return <StickScan />; }

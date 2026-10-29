import type { Metadata } from "next";
import Tracking from "../../components/scan/Tracking";

export const metadata: Metadata = { title: "Item tracking | WHOLESTRA", robots: { index: false } };
export default function TrackingPage() { return <Tracking />; }

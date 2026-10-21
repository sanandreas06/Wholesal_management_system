import type { Metadata } from "next";
import PlatformMonitor from "../../../components/PlatformMonitor";

export const metadata: Metadata = { title: "Platform monitor | WHOLESTRA", robots: { index: false } };
export default function Page() { return <PlatformMonitor />; }

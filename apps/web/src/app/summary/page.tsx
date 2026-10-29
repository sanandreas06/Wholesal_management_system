import type { Metadata } from "next";
import DailySummary from "../../components/balances/DailySummary";

export const metadata: Metadata = { title: "Daily summary | WHOLESTRA", robots: { index: false } };
export default function SummaryPage() { return <DailySummary />; }

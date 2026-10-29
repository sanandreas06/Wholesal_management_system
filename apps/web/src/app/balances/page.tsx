import type { Metadata } from "next";
import Balances from "../../components/balances/Balances";

export const metadata: Metadata = { title: "Money owed | WHOLESTRA", robots: { index: false } };
export default function BalancesPage() { return <Balances />; }

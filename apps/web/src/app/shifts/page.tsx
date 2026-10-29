import type { Metadata } from "next";
import ShiftsList from "../../components/balances/ShiftsList";

export const metadata: Metadata = { title: "Cashier shifts | WHOLESTRA", robots: { index: false } };
export default function ShiftsPage() { return <ShiftsList />; }

import type { Metadata } from "next";
import CustomerDisplay from "../../../components/counter/CustomerDisplay";

export const metadata: Metadata = { title: "Customer screen | WHOLESTRA", robots: { index: false } };
export default function DisplayPage() { return <CustomerDisplay />; }

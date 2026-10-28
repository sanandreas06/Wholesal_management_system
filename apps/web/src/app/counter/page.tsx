import type { Metadata } from "next";
import Counter from "../../components/counter/Counter";

export const metadata: Metadata = { title: "Counter | WHOLESTRA", robots: { index: false } };
export default function CounterPage() { return <Counter />; }

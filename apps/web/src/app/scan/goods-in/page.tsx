import type { Metadata } from "next";
import GoodsIn from "../../../components/scan/GoodsIn";

export const metadata: Metadata = { title: "Goods in | WHOLESTRA", robots: { index: false } };
export default function GoodsInPage() { return <GoodsIn />; }

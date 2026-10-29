import type { Metadata } from "next";
import ReleaseGoods from "../../../components/scan/ReleaseGoods";

export const metadata: Metadata = { title: "Release to customer | WHOLESTRA", robots: { index: false } };
export default function ReleasePage() { return <ReleaseGoods />; }

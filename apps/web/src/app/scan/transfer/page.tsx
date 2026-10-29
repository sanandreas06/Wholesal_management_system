import type { Metadata } from "next";
import TransferScan from "../../../components/scan/TransferScan";

export const metadata: Metadata = { title: "Transfer | WHOLESTRA", robots: { index: false } };
export default function TransferScanPage() { return <TransferScan />; }

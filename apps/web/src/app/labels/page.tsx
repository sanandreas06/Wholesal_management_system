import type { Metadata } from "next";
import LabelSheet from "../../components/scan/LabelSheet";
import "../../components/scan/labels.css";

export const metadata: Metadata = { title: "Labels | WHOLESTRA", robots: { index: false } };
export default function LabelsPage() { return <LabelSheet />; }

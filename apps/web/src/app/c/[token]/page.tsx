import type { Metadata } from "next";
import ConfirmGoods from "../../../components/confirm/ConfirmGoods";

export const metadata: Metadata = { title: "Confirm your goods | WHOLESTRA", robots: { index: false, follow: false } };

/** The page a customer opens from the QR on their receipt or release note: no sign-in, the code in the link is the key. */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ConfirmGoods token={token} />;
}

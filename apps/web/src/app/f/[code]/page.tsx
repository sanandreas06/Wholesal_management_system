import { redirect } from "next/navigation";

/** What a WHOLESTRA "finding" QR opens: the product or item on the Find page (sign-in first, if needed). */
export default async function FindCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/tracking?code=${encodeURIComponent(decodeURIComponent(code).slice(0, 64))}`);
}

import type { Metadata } from "next";
import DriverTrip from "../../../components/driver/DriverTrip";

export const metadata: Metadata = { title: "Trip | WHOLESTRA", robots: { index: false, follow: false } };

/** The driver's page, opened from the WhatsApp link: no sign-in, the code in the link is the key. */
export default async function TripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DriverTrip token={token} />;
}

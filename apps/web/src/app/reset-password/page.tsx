import type { Metadata } from "next";
import ResetPasswordFlow from "../../components/auth/ResetPasswordFlow";

export const metadata: Metadata = { title: "Choose a new password | WHOLESTRA", robots: { index: false } };
export default function ResetPassword() { return <ResetPasswordFlow />; }

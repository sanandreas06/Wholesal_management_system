import type { Metadata } from "next";
import CompanySetup from "../../components/auth/CompanySetup";

export const metadata: Metadata = { title: "Set up your company | WHOLESTRA" };
export default function Setup() { return <CompanySetup />; }

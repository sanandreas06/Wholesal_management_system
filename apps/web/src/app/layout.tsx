import "./globals.css";
import type { Metadata, Viewport } from "next";
import WebAppSetup from "../components/WebAppSetup";

export const metadata: Metadata = {
  title: "WHOLESTRA — wholesale management for every branch",
  description: "WHOLESTRA: stock, sales, purchasing, finance and a tamper-evident change log for multi-branch wholesale businesses.",
  applicationName: "WHOLESTRA",
  appleWebApp: { capable: true, title: "WHOLESTRA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: "#0B1B3E", width: "device-width", initialScale: 1 };

// Chrome may offer to install before the page has finished starting, so catch that offer straight away.
const EARLY = "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__wmsInstall=e;});";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&family=Bricolage+Grotesque:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <WebAppSetup />
      </body>
    </html>
  );
}

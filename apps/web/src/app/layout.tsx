import "./globals.css";
export const metadata={title:"WHOLESTRA — wholesale management for every branch",description:"WHOLESTRA: stock, sales, purchasing, finance and a tamper-evident change log for multi-branch wholesale businesses."};
export default function RootLayout({children}:{children:React.ReactNode}){return (
  <html lang="en">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&family=Bricolage+Grotesque:wght@600;700;800&display=swap" rel="stylesheet" />
    </head>
    <body>{children}</body>
  </html>
)}
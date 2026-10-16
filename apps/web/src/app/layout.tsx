import "./globals.css";
export const metadata={title:"Wholesale Management System",description:"Phase 1 ERP foundation"};
export default function RootLayout({children}:{children:React.ReactNode}){return (
  <html lang="en">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet" />
    </head>
    <body>{children}</body>
  </html>
)}
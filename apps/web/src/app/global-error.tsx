'use client';

/** Last resort when even the main frame of the site fails. It has to bring its own page and styles. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F3F6FB", color: "#0E1A3A", fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#B8860B" }}>WHOLESTRA</p>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "#55627F", lineHeight: 1.6 }}>The page could not open. Your saved work is safe. Please try again in a moment.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <button onClick={reset} style={{ padding: "12px 20px", borderRadius: 12, border: 0, background: "#0B1B3E", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
            <a href="/" style={{ padding: "12px 20px", borderRadius: 12, border: "1.5px solid #E2E5EA", color: "#0E1A3A", fontWeight: 700, textDecoration: "none" }}>Home page</a>
          </div>
        </main>
      </body>
    </html>
  );
}

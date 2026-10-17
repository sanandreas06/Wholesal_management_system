/** A product's picture, or (when it has none) a coloured tile with its first letters, so lists of products are easy to scan. */
const COLORS = ["#2563EB", "#16A34A", "#C97A2E", "#7C3AED", "#0891B2", "#B23B3B", "#0F766E", "#9333EA"];
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

export default function ProductThumb({ name, src, size = 44, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.24) };
  if (src) return <img className={`pthumb ${className}`.trim()} src={src} alt="" width={size} height={size} style={{ ...style, objectFit: "cover" }} loading="lazy" />;
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return <span className={`pthumb ${className}`.trim()} aria-hidden="true" style={{ ...style, background: COLORS[hash(name) % COLORS.length], fontSize: Math.round(size * 0.36) }}>{letters}</span>;
}

/** Small flat illustrations of inventory things, drawn as SVG so they stay sharp and follow no external files. Each one is decorative (aria-hidden). Solid colours only, so any number can sit on one page without clashing ids. */

type P = { className?: string };
const S = (c: React.ReactNode, cls?: string) => <svg className={cls} viewBox="0 0 96 96" aria-hidden="true" focusable="false">{c}</svg>;

export const Box = ({ className }: P) => S(<>
  <path d="M48 20 L82 37 L48 54 L14 37 Z" fill="#F0CE8A" />
  <path d="M14 37 L48 54 L48 90 L14 72 Z" fill="#C9953F" />
  <path d="M48 54 L82 37 L82 72 L48 90 Z" fill="#DDAA55" />
  <path d="M31 28.5 L65 45.5 L65 52 L31 35 Z" fill="#B7791F" opacity=".5" />
  <path d="M20 52 L36 60 L36 70 L20 62 Z" fill="#fff" opacity=".85" />
  <path d="M23 55 L33 60 M23 59 L30 62.5" stroke="#8A5A12" strokeWidth="1.4" strokeLinecap="round" />
</>, className);

export const Boxes = ({ className }: P) => S(<>
  <path d="M10 60 L34 72 L34 90 L10 78 Z" fill="#C9953F" /><path d="M34 72 L58 60 L58 78 L34 90 Z" fill="#DDAA55" /><path d="M10 60 L34 48 L58 60 L34 72 Z" fill="#F0CE8A" />
  <path d="M50 52 L72 63 L72 82 L50 71 Z" fill="#C9953F" /><path d="M72 63 L90 54 L90 73 L72 82 Z" fill="#DDAA55" /><path d="M50 52 L68 43 L90 54 L72 63 Z" fill="#F0CE8A" />
  <path d="M26 24 L46 34 L46 52 L26 42 Z" fill="#C9953F" /><path d="M46 34 L66 24 L66 42 L46 52 Z" fill="#DDAA55" /><path d="M26 24 L46 14 L66 24 L46 34 Z" fill="#F0CE8A" />
</>, className);

export const Scanner = ({ className }: P) => S(<>
  <path d="M30 10 L66 10 Q72 10 72 16 L72 36 Q72 42 66 42 L30 42 Q24 42 24 36 L24 16 Q24 10 30 10 Z" fill="#3B66D9" />
  <rect x="30" y="16" width="36" height="20" rx="4" fill="#EAF1FF" />
  <path d="M34 22 H44 M34 27 H52 M34 32 H40" stroke="#2563EB" strokeWidth="2.4" strokeLinecap="round" />
  <path d="M38 42 L58 42 L62 86 Q62 90 58 90 L40 90 Q36 90 36 86 Z" fill="#2B4FB0" />
  <rect x="41" y="52" width="14" height="6" rx="3" fill="#EAF1FF" />
</>, className);

export const Truck = ({ className }: P) => S(<>
  <rect x="4" y="28" width="52" height="38" rx="5" fill="#EAF1FF" stroke="#2563EB" strokeWidth="2.5" />
  <path d="M56 40 H74 L88 54 V66 H56 Z" fill="#2563EB" />
  <path d="M62 44 H72 L82 54 H62 Z" fill="#EAF1FF" />
  <path d="M14 38 H34 M14 46 H28" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity=".55" />
  <circle cx="24" cy="68" r="8" fill="#13285A" stroke="#8FB0FF" strokeWidth="1.5" /><circle cx="24" cy="68" r="3" fill="#EAF1FF" />
  <circle cx="72" cy="68" r="8" fill="#13285A" stroke="#8FB0FF" strokeWidth="1.5" /><circle cx="72" cy="68" r="3" fill="#EAF1FF" />
  <path d="M-2 40 H-10 M2 50 H-12" stroke="#8FB0FF" strokeWidth="2.5" strokeLinecap="round" opacity="0" />
</>, className);

export const Shelf = ({ className }: P) => S(<>
  <path d="M10 8 V90 M86 8 V90" stroke="#13285A" strokeWidth="5" strokeLinecap="round" />
  <path d="M8 34 H88 M8 62 H88 M8 90 H88" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
  <rect x="16" y="14" width="18" height="20" rx="2" fill="#DDAA55" /><rect x="38" y="20" width="14" height="14" rx="2" fill="#F0CE8A" /><rect x="56" y="12" width="22" height="22" rx="2" fill="#C9953F" />
  <rect x="16" y="46" width="24" height="16" rx="2" fill="#F0CE8A" /><rect x="44" y="40" width="16" height="22" rx="2" fill="#DDAA55" /><rect x="64" y="50" width="14" height="12" rx="2" fill="#C9953F" />
  <rect x="18" y="72" width="14" height="18" rx="2" fill="#C9953F" /><rect x="36" y="76" width="22" height="14" rx="2" fill="#DDAA55" /><rect x="62" y="68" width="16" height="22" rx="2" fill="#F0CE8A" />
</>, className);

export const Clipboard = ({ className }: P) => S(<>
  <rect x="18" y="12" width="60" height="78" rx="8" fill="#fff" stroke="#2563EB" strokeWidth="3" />
  <rect x="34" y="6" width="28" height="14" rx="5" fill="#13285A" />
  <path d="M28 38 l5 5 9-10 M28 56 l5 5 9-10 M28 74 l5 5 9-10" fill="none" stroke="#16A34A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M50 38 H68 M50 56 H68 M50 74 H62" stroke="#A9B6CF" strokeWidth="3.2" strokeLinecap="round" />
</>, className);

export const Barcode = ({ className }: P) => S(<>
  <rect x="8" y="22" width="80" height="52" rx="6" fill="#fff" stroke="#E1E7F0" strokeWidth="2" />
  <g fill="#0B1B3E"><rect x="18" y="30" width="3" height="28" /><rect x="24" y="30" width="6" height="28" /><rect x="33" y="30" width="2" height="28" /><rect x="38" y="30" width="5" height="28" /><rect x="46" y="30" width="3" height="28" /><rect x="52" y="30" width="7" height="28" /><rect x="62" y="30" width="2" height="28" /><rect x="67" y="30" width="4" height="28" /><rect x="74" y="30" width="3" height="28" /></g>
  <path d="M18 66 H78" stroke="#A9B6CF" strokeWidth="3" strokeLinecap="round" />
  <path d="M4 44 H92" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
</>, className);

export const Tag = ({ className }: P) => S(<>
  <path d="M12 12 H48 L88 52 L52 88 L12 48 Z" fill="#2563EB" />
  <circle cx="28" cy="28" r="6" fill="#EAF1FF" />
  <path d="M42 50 L56 64 M52 46 L66 60" stroke="#EAF1FF" strokeWidth="3.4" strokeLinecap="round" opacity=".85" />
  <text x="44" y="46" fontFamily="Sora,sans-serif" fontSize="15" fontWeight="800" fill="#EAF1FF" transform="rotate(45 44 46)">GH₵</text>
</>, className);

export const Bars = ({ className }: P) => S(<>
  <rect x="8" y="14" width="80" height="68" rx="10" fill="#fff" stroke="#E1E7F0" strokeWidth="2" />
  <rect x="20" y="52" width="12" height="20" rx="3" fill="#8FB0FF" /><rect x="38" y="42" width="12" height="30" rx="3" fill="#5C8DF3" /><rect x="56" y="32" width="12" height="40" rx="3" fill="#2563EB" />
  <path d="M20 40 L38 30 L52 34 L70 22" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
</>, className);

/** A bigger warehouse picture for the sign-in page: racks full of boxes, a scanning beam, and a delivery truck at the bottom. */
export function WarehouseScene({ className }: P) {
  const rack = (x: number) => (
    <g key={x}>
      <path d={`M${x} 40 V230 M${x + 150} 40 V230`} stroke="#2A4585" strokeWidth="7" strokeLinecap="round" />
      {[96, 158, 220].map((y) => <path key={y} d={`M${x - 6} ${y} H${x + 156}`} stroke="#4A78E6" strokeWidth="6" strokeLinecap="round" />)}
    </g>
  );
  const crates: [number, number, number, number, string][] = [
    [30, 54, 34, 40, "#DDAA55"], [68, 66, 28, 28, "#F0CE8A"], [100, 50, 40, 44, "#C9953F"],
    [26, 112, 44, 42, "#F0CE8A"], [74, 120, 30, 34, "#C9953F"], [108, 108, 34, 46, "#DDAA55"],
    [32, 176, 30, 40, "#C9953F"], [66, 184, 44, 32, "#DDAA55"], [114, 170, 28, 46, "#F0CE8A"],
  ];
  return (
    <svg className={className} viewBox="0 0 400 300" role="img" aria-label="Illustration of a warehouse with stocked shelves and a delivery truck">
      <rect width="400" height="300" rx="0" fill="none" />
      <g>{rack(30)}</g>
      <g transform="translate(200 0)">{rack(30)}</g>
      <g>{crates.map(([x, y, w, h, c], i) => <rect key={i} className="au-crate" style={{ animationDelay: `${i * 0.35}s` }} x={x} y={y} width={w} height={h} rx="3" fill={c} />)}</g>
      <g transform="translate(200 0)">{crates.slice().reverse().map(([x, y, w, h, c], i) => <rect key={i} className="au-crate" style={{ animationDelay: `${i * 0.5 + 0.2}s` }} x={x} y={y} width={w} height={h} rx="3" fill={c} />)}</g>
      <rect className="au-beam" x="10" y="40" width="380" height="3" rx="2" fill="#EF4444" opacity=".75" />
      <rect x="0" y="262" width="400" height="38" fill="#0A1633" />
      <g className="au-truck" transform="translate(0 214)">
        <rect x="8" y="14" width="76" height="48" rx="6" fill="#EAF1FF" /><path d="M84 28 H112 L132 46 V62 H84 Z" fill="#2563EB" /><path d="M92 32 H108 L120 46 H92 Z" fill="#EAF1FF" />
        <path d="M20 26 H56 M20 38 H44" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" opacity=".55" />
        <circle cx="34" cy="64" r="11" fill="#0B1B3E" stroke="#EAF1FF" strokeWidth="2" /><circle cx="108" cy="64" r="11" fill="#0B1B3E" stroke="#EAF1FF" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** A small warehouse shelf drawn for the error pages. Every page shares the shelf and cartons; `kind` adds the one detail that tells the story:
 *  a gap where a carton should be (not found), a padlock (no access), a clock (link expired), a turn-back arrow (cancelled), or a warning sign (something broke). */
export type ArtKind = "missing" | "locked" | "expired" | "cancelled" | "broken";

function Carton({ x, y, w = 44, h = 34 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="#E3B36B" />
      <rect x={x} y={y} width={w} height={h} rx="3" fill="none" stroke="#BC8240" strokeWidth="1.5" />
      <rect x={x + w / 2 - 4} y={y} width="8" height={h} fill="#F3D49F" opacity=".85" />
      <path d={`M${x + 6} ${y + h - 9} h12`} stroke="#8A5A22" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

export default function StatusArt({ kind, label }: { kind: ArtKind; label?: string }) {
  return (
    <svg className="ep-art" viewBox="0 0 260 190" role="img" aria-label={label ?? "Illustration of a warehouse shelf"}>
      {/* the rack */}
      <rect x="18" y="14" width="8" height="166" rx="3" className="ep-rack" />
      <rect x="234" y="14" width="8" height="166" rx="3" className="ep-rack" />
      <rect x="14" y="78" width="232" height="8" rx="3" className="ep-plank" />
      <rect x="14" y="160" width="232" height="8" rx="3" className="ep-plank" />
      {/* top shelf */}
      <Carton x={34} y={44} />
      <Carton x={84} y={44} />
      <Carton x={134} y={44} />
      <Carton x={184} y={52} w={40} h={26} />
      {/* bottom shelf */}
      <Carton x={34} y={126} />
      {kind === "missing"
        ? <g>
            <rect x="84" y="122" width="48" height="38" rx="4" fill="none" className="ep-gap" strokeWidth="2" strokeDasharray="6 5" />
            <text x="108" y="147" textAnchor="middle" className="ep-gap-txt">404</text>
          </g>
        : <Carton x={86} y={126} />}
      <Carton x={138} y={118} w={44} h={42} />
      <Carton x={188} y={134} w={38} h={26} />
      {/* the detail for this page */}
      {kind === "locked" && <g transform="translate(166 86)">
        <circle cx="30" cy="30" r="30" fill="#0B1B3E" />
        <path d="M20 28 v-6 a10 10 0 0 1 20 0 v6" fill="none" stroke="#E5B340" strokeWidth="4" strokeLinecap="round" />
        <rect x="16" y="27" width="28" height="20" rx="4" fill="#E5B340" />
        <circle cx="30" cy="36" r="3" fill="#0B1B3E" /><rect x="28.6" y="37" width="2.8" height="6" rx="1" fill="#0B1B3E" />
      </g>}
      {kind === "expired" && <g transform="translate(166 86)">
        <circle cx="30" cy="30" r="30" fill="#0B1B3E" />
        <circle cx="30" cy="30" r="19" fill="none" stroke="#E5B340" strokeWidth="4" />
        <path d="M30 19 v12 l8 5" fill="none" stroke="#E5B340" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
      {kind === "cancelled" && <g transform="translate(166 86)">
        <circle cx="30" cy="30" r="30" fill="#0B1B3E" />
        <path d="M40 40 a12 12 0 1 0 -12 -14" fill="none" stroke="#E5B340" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 19 l8 7 l-9 5" fill="none" stroke="#E5B340" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
      {kind === "broken" && <g transform="translate(166 86)">
        <circle cx="30" cy="30" r="30" fill="#0B1B3E" />
        <path d="M30 14 L47 44 H13 Z" fill="#E5B340" strokeLinejoin="round" />
        <rect x="28" y="24" width="4" height="11" rx="2" fill="#0B1B3E" /><circle cx="30" cy="39.5" r="2.4" fill="#0B1B3E" />
      </g>}
    </svg>
  );
}

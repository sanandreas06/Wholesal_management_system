/** WHOLESTRA logo. The emblem is an original mark: a gold diamond (the kente weaver's basic cell) around a W, with a dot above and below like the dots in Adinkra stamps. Solid colours only, so it stays sharp at any size and needs no ids. */

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`wl-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0F2A21" stroke="#E0AE3B" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M32 8 L56 32 L32 56 L8 32 Z" fill="none" stroke="#E0AE3B" strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points="19,24 26,40 32,29 38,40 45,24" fill="none" stroke="#E0AE3B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="17" r="2.2" fill="#E0AE3B" />
      <circle cx="32" cy="47" r="2" fill="#E0AE3B" />
    </svg>
  );
}

/** Emblem plus the WHOLESTRA name and "BY BOATENG". Text takes the colour of its parent. */
export default function Logo({ size = 40, word = true, className = "" }: { size?: number; word?: boolean; className?: string }) {
  return (
    <span className={`wl-logo ${className}`.trim()} role="img" aria-label="WHOLESTRA by BOATENG">
      <LogoMark size={size} />
      {word && <span className="wl-word" aria-hidden="true"><strong>WHOLESTRA</strong><small>BY BOATENG</small></span>}
    </span>
  );
}

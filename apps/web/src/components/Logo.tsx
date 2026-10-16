/** WHOLESTRA logo. The emblem is a gold helmet-shaped shield with an upward arrow: protection and growth. Solid colours only, so it stays sharp at any size and needs no ids. Drawn on its own navy tile so it reads on light and dark pages alike. */

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`wl-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0B1B3E" stroke="#2B4A9A" strokeWidth="1.5" /><path d="M14 28 C14 17 22 11 32 7 C42 11 50 17 50 28 L44 26 C43 20 38 15.5 32 12.5 C26 15.5 21 20 20 26 Z" fill="#E5B340"/><path d="M32 12.8 L26.5 20.5 L29.9 20.5 L29.9 31 L34.1 31 L34.1 20.5 L37.5 20.5 Z" fill="#EAF1FF"/><path d="M15 31 L28.5 28.5 L28.5 32 L17 35 Z M49 31 L35.5 28.5 L35.5 32 L47 35 Z" fill="#EAF1FF"/><path d="M15 38 L20 36.5 L20 48 L26 53 L26 57 L15 50 Z M49 38 L44 36.5 L44 48 L38 53 L38 57 L49 50 Z M26 37 L38 37 L38 41 L26 41 Z" fill="#EAF1FF"/><path d="M27 42.5 L37 42.5 L37 52 L32 58 L27 52 Z" fill="#E5B340"/><path d="M30.4 45 L33.6 45 L33.6 52 L32 53.8 L30.4 52 Z" fill="#0B1B3E"/>
    </svg>
  );
}

/** Emblem plus the WHOLESTRA name. Text takes the colour of its parent. */
export default function Logo({ size = 40, word = true, className = "" }: { size?: number; word?: boolean; className?: string }) {
  return (
    <span className={`wl-logo ${className}`.trim()} role="img" aria-label="WHOLESTRA">
      <LogoMark size={size} />
      {word && <span className="wl-word" aria-hidden="true"><strong>WHOLESTRA</strong></span>}
    </span>
  );
}

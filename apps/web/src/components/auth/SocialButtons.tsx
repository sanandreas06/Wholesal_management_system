'use client';
import { AuthOptions, oauthUrl } from "../../lib/authApi";

const G = <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
const F = <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1877F2"/><path fill="#fff" d="M13.4 19.5v-6h2l.3-2.4h-2.3V9.6c0-.7.2-1.2 1.2-1.2h1.3V6.3c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.7H8.7v2.4h2.1v6z"/></svg>;
const L = <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path fill="#fff" d="M7.1 9.6h-2.6V19h2.6zM5.8 5.2a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM19.5 13.6c0-2.6-1.4-4.2-3.6-4.2-1.3 0-2.2.7-2.6 1.3V9.6h-2.5V19h2.6v-4.9c0-1.2.5-2.2 1.7-2.2s1.7.9 1.7 2.2V19h2.7z"/></svg>;

const LIST = [{ id: "google", label: "Google", icon: G }, { id: "facebook", label: "Facebook", icon: F }, { id: "linkedin", label: "LinkedIn", icon: L }] as const;

/** "Continue with Google / Facebook / LinkedIn". Only the providers switched on for this site are clickable; the others say they are not available yet. */
export default function SocialButtons({ options, mode, referral, loading }: { options: AuthOptions; mode: "signin" | "signup"; referral?: string; loading?: boolean }) {
  const any = options.social;
  return (
    <div className="au-social">
      <div className="au-social-row">
        {LIST.map((p) => {
          const on = options.providers[p.id];
          return on && !loading
            ? <a key={p.id} className="au-soc" href={oauthUrl(p.id, mode, referral)}>{p.icon}<span>{p.label}</span></a>
            : <span key={p.id} className="au-soc off" aria-disabled="true" title={loading ? "Checking..." : `${p.label} sign-in is not switched on yet`}>{p.icon}<span>{p.label}</span></span>;
        })}
      </div>
      {!loading && !any && <p className="au-note">Google, Facebook and LinkedIn sign-in will appear here once they are switched on for this site.</p>}
    </div>
  );
}

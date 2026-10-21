export interface SessionUser {
  id?: string;
  name: string;
  email: string;
  organization?: string;
  branch: string | null;
  /** set when limited to one branch */
  branchScope?: string | null;
  roles: string[];
  permissions: string[];
  /** the company's currency code, for example GHS */
  currency?: string;
  /** the shared, read-only demo company */
  demo?: boolean;
  /** a new company that has not filled in its profile yet */
  setupPending?: boolean;
  /** an authenticator app protects this account */
  authenticator?: boolean;
  /** false for someone who signed up with Google/Facebook/LinkedIn and has not chosen a password */
  passwordSet?: boolean;
  /** in the demo: the shop or company name the visitor typed */
  demoFor?: string;
  /** the company's workspace ID, shown in app addresses: /w/<workspace>/dashboard */
  workspace?: string;
  /** one of the people who run WHOLESTRA (PLATFORM_ADMINS on the server): may open the Platform monitor */
  platformAdmin?: boolean;
}

/** "Remember this browser for 5 hours" after the authenticator check: the server's signed note, kept per email. */
const trustKey = (email: string) => `wms_trust:${email.trim().toLowerCase()}`;
export function saveTrust(email: string, token?: string) { if (!token) return; try { localStorage.setItem(trustKey(email), token); } catch { /* storage unavailable */ } }
export function getTrust(email: string) { try { return localStorage.getItem(trustKey(email)) || undefined; } catch { return undefined; } }

export function saveSession(accessToken: string, user: SessionUser) {
  localStorage.setItem("wms_access_token", accessToken);
  localStorage.setItem("wms_user", JSON.stringify(user));
  // a fresh sign-in counts as activity, so an old idle time never signs someone straight back out
  localStorage.setItem("wms_last_active", String(Date.now()));
}

/** Changes a few details of the signed-in person without signing in again. */
export function updateSessionUser(patch: Partial<SessionUser>) {
  const u = getSessionUser();
  if (u) localStorage.setItem("wms_user", JSON.stringify({ ...u, ...patch }));
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("wms_user");
  if (!raw) return null;
  try { return JSON.parse(raw) as SessionUser; } catch { return null; }
}

export function hasPermission(permission: string): boolean {
  const user = getSessionUser();
  return !!user?.permissions.includes(permission);
}

/** Forgets the session but keeps the light/dark choice and the "trusted for 5 hours" notes. */
export function clearSession() {
  const keep: [string, string][] = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k === "wms_theme" || k.startsWith("wms_trust:")) keep.push([k, localStorage.getItem(k) ?? ""]); } } catch { /* storage unavailable */ }
  try { localStorage.clear(); sessionStorage.removeItem("wms_profile"); } catch { /* ignore */ }
  try { keep.forEach(([k, v]) => localStorage.setItem(k, v)); } catch { /* ignore */ }
}

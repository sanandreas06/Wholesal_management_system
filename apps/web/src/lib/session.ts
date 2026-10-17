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
}

export function saveSession(accessToken: string, user: SessionUser) {
  localStorage.setItem("wms_access_token", accessToken);
  localStorage.setItem("wms_user", JSON.stringify(user));
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

/** Forgets the session but keeps the light/dark choice. */
export function clearSession() {
  let theme: string | null = null;
  try { theme = localStorage.getItem("wms_theme"); } catch { /* storage unavailable */ }
  try { localStorage.clear(); sessionStorage.removeItem("wms_profile"); } catch { /* ignore */ }
  try { if (theme) localStorage.setItem("wms_theme", theme); } catch { /* ignore */ }
}

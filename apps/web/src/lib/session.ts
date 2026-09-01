export interface SessionUser {
  id?: string;
  name: string;
  email: string;
  organization?: string;
  branch: string | null;
  roles: string[];
  permissions: string[];
}

export function saveSession(accessToken: string, user: SessionUser) {
  localStorage.setItem("wms_access_token", accessToken);
  localStorage.setItem("wms_user", JSON.stringify(user));
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

export function clearSession() {
  localStorage.clear();
}

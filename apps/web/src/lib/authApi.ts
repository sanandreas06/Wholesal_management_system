import { ApiError } from "./api";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/** Calls for the sign-in and sign-up pages. Unlike the app's own `api`, a 401 here is just an answer ("wrong password"), never a reason to leave the page. */
async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  } catch {
    throw new ApiError("We could not reach the server. Check your connection and try again.", 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const m = data && (data as { message?: unknown }).message;
    throw new ApiError(Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : "Something went wrong. Please try again.", res.status);
  }
  return data as T;
}

export const authApi = {
  get: <T>(path: string, token?: string) => call<T>(path, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  post: <T>(path: string, body?: unknown, token?: string) => call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body), headers: token ? { Authorization: `Bearer ${token}` } : {} }),
};

export type AuthOptions = { emailCodes: boolean; emailSignup: boolean; smsCodes?: boolean; providers: { google: boolean; facebook: boolean; linkedin: boolean }; social: boolean; demo: boolean };
export const NO_OPTIONS: AuthOptions = { emailCodes: false, emailSignup: false, providers: { google: false, facebook: false, linkedin: false }, social: false, demo: true };

/** Where the "Continue with Google / Facebook / LinkedIn" buttons go. The server does the rest and comes back to /auth/complete. */
export function oauthUrl(provider: "google" | "facebook" | "linkedin", mode: "signin" | "signup", ref?: string, hint?: string) {
  const q = new URLSearchParams({ mode });
  if (ref) q.set("ref", ref);
  if (hint) q.set("hint", hint);
  return `${API_URL}/auth/oauth/${provider}?${q}`;
}

/** Friendly words for the ?error= codes the social sign-in can come back with. */
export const OAUTH_ERRORS: Record<string, string> = {
  state: "That sign-in took too long or was opened in another browser. Please try again.",
  cancelled: "Sign-in was cancelled.",
  failed: "We could not finish signing you in with that provider. Please try again, or use your email.",
  "no-email": "That account did not share an email address with us. Please use your email instead.",
  "email-unverified": "That account's email address is not confirmed yet. Please confirm it with the provider, or use your email instead.",
  blocked: "This account is switched off. Ask your owner or administrator.",
  "no-account": "There is no WHOLESTRA account for that account yet. Create one below.",
};

export type SessionResponse = { accessToken: string; mustChangePassword?: boolean; user: import("./session").SessionUser };

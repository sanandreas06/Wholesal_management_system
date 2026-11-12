const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wms_access_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const t = token();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    // the request never got an answer: no internet, or the server is waking up or restarting after an update
    throw new ApiError(typeof navigator !== "undefined" && navigator.onLine === false
      ? "You are offline. Check your internet connection and try again."
      : "Could not reach the WHOLESTRA server. It may be starting up or updating: wait a minute and try again. Nothing was saved.", 0);
  }
  if (res.status === 401) {
    localStorage.clear();
    // "your session ended" only for someone who was signed in; a visitor with no session is simply asked to sign in
    if (typeof window !== "undefined") window.location.href = `/login?${t ? "expired=1&" : ""}next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new ApiError("Session expired", 401);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const rawMessage = data && data.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(", ")
      : rawMessage || (res.status >= 502 && res.status <= 504 ? `The server is restarting or busy (error ${res.status}). Wait a minute and try again. Nothing was saved.` : `Request failed (error ${res.status}).`);
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" })
};

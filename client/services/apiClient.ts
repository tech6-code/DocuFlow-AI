const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:5050/api";

const ACCESS_TOKEN_KEY = "df_access_token";
const REFRESH_TOKEN_KEY = "df_refresh_token";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type SessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export function setSession(session: SessionPayload | null) {
  if (!session || !session.access_token || !session.refresh_token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
}

export function getAccessToken() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

export function getRefreshToken() {
  const token = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

export function clearSession() {
  setSession(null);
}

let authFailureHandler: (() => void) | null = null;

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler;
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
  } catch (_err) {
    // Network/service outage: don't clear session here.
    return null;
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
    }
    return null;
  }

  const data = await res.json();
  if (data?.session) {
    setSession(data.session);
    return data.session as SessionPayload;
  }

  return null;
}

export async function apiFetch(path: string, options: RequestInit = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch (_err) {
    throw new ApiError("Network error. Please check your connection and try again.");
  }

  if (res.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed?.access_token) {
      return apiFetch(path, options, false);
    }
    if (authFailureHandler) authFailureHandler();
  }

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const err = await res.json();
      throw new ApiError(err?.message || res.statusText, res.status);
    }
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
  }

  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res.text();
}

export { API_BASE };

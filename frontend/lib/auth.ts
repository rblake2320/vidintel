/**
 * Local auth helper — calls our FastAPI backend for auth.
 * No Supabase SDK dependency; stores JWT in localStorage.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "vidintel_token";
const USER_KEY = "vidintel_user";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthResponse {
  access_token: string;
  user_id: string;
  email: string;
}

async function _authRequest(path: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Auth request failed");
  }
  return res.json();
}

function _store(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify({ id: data.user_id, email: data.email }));
  window.dispatchEvent(new Event("vidintel-auth-changed"));
}

export async function login(email: string, password: string): Promise<void> {
  const data = await _authRequest("/api/auth/login", email, password);
  _store(data);
}

export async function register(email: string, password: string): Promise<void> {
  const data = await _authRequest("/api/auth/register", email, password);
  _store(data);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("vidintel-auth-changed"));
}

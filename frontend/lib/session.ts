import { cookies } from "next/headers";

import { SESSION_COOKIE, type AuthUser } from "@/lib/auth";

import { backendBaseUrl } from "./backend";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function fetchCurrentUser(token: string): Promise<AuthUser | null> {
  const upstream = await fetch(`${backendBaseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!upstream.ok) return null;
  return (await upstream.json()) as AuthUser;
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

export function jsonWithSessionCookie<T>(token: string, body: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
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
  try {
    const upstream = await fetch(`${backendBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!upstream.ok) return null;

    const text = await upstream.text();
    if (!text.trim()) return null;

    return JSON.parse(text) as AuthUser;
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { SESSION_COOKIE } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/app", "/dashboard"];

function jwtSecret(): Uint8Array {
  const secret =
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "dev-change-me-in-production-use-long-random-string";
  return new TextEncoder().encode(secret);
}

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, jwtSecret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await hasValidSession(token);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAuthPage = pathname.startsWith("/auth/");

  if (isProtected && !valid) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/signin";
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (isAuthPage && valid) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/dashboard/:path*", "/auth/:path*"],
};

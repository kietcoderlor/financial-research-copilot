import { jwtVerify } from "jose";

import type { AuthUser } from "@/lib/auth";

function jwtSecret(): Uint8Array {
  const secret =
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "dev-change-me-in-production-use-long-random-string";
  return new TextEncoder().encode(secret);
}

/** Decode a valid session JWT when the backend /auth/me endpoint is unavailable. */
export async function userFromSessionToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    const id = payload.sub;
    if (typeof id !== "string" || !id) return null;

    const email = typeof payload.email === "string" ? payload.email : "";

    return {
      id,
      email,
      name: email ? email.split("@")[0] : null,
      image_url: null,
      email_verified: true,
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

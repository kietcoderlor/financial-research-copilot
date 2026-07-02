import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const upstream = await fetch(`${backendBaseUrl()}/auth/google`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  await setSessionCookie(data.access_token);
  return NextResponse.json({ user: data.user });
}

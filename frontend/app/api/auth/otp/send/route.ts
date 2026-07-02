import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const upstream = await fetch(`${backendBaseUrl()}/auth/otp/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

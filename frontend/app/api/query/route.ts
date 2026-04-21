import { NextRequest, NextResponse } from "next/server";

function backendBaseUrl(): string {
  const raw = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return raw.replace(/\/$/, "");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.text();
  const upstream = await fetch(`${backendBaseUrl()}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    cache: "no-store",
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}

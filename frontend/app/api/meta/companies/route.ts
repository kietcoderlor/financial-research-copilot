import { NextResponse } from "next/server";

function backendBaseUrl(): string {
  const raw = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return raw.replace(/\/$/, "");
}

export async function GET(): Promise<NextResponse> {
  const upstream = await fetch(`${backendBaseUrl()}/meta/companies`, {
    method: "GET",
    cache: "no-store",
  });
  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}

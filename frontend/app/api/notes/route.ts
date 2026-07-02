import { NextRequest, NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function GET(request: NextRequest): Promise<Response> {
  const headers = await backendAuthHeaders();
  if (headers instanceof NextResponse) return headers;
  const qs = request.nextUrl.searchParams.toString();
  const suffix = qs ? `?${qs}` : "";

  const upstream = await fetch(`${backendBaseUrl()}/notes${suffix}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const headers = await backendAuthHeaders({ "Content-Type": "application/json" });
  if (headers instanceof NextResponse) return headers;

  const payload = await request.text();
  const upstream = await fetch(`${backendBaseUrl()}/notes`, {
    method: "POST",
    headers,
    body: payload,
    cache: "no-store",
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}


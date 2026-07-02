import { NextRequest, NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = await backendAuthHeaders({ "Content-Type": "application/json" });
  if (headers instanceof NextResponse) return headers;

  const payload = await request.text();
  const upstream = await fetch(`${backendBaseUrl()}/query`, {
    method: "POST",
    headers,
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

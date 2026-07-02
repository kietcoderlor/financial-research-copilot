import { NextRequest, NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";
import { backendAuthHeaders } from "@/lib/proxyAuth";

export async function POST(request: NextRequest): Promise<Response> {
  const headers = await backendAuthHeaders({ "Content-Type": "application/json" });
  if (headers instanceof NextResponse) return headers;

  const payload = await request.text();
  const upstream = await fetch(`${backendBaseUrl()}/query/stream`, {
    method: "POST",
    headers,
    body: payload,
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

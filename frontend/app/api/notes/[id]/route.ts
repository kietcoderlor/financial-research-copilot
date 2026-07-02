import { NextRequest, NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";
import { backendAuthHeaders } from "@/lib/proxyAuth";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: NextRequest, context: Context): Promise<Response> {
  const { id } = await context.params;
  const headers = await backendAuthHeaders();
  if (headers instanceof NextResponse) return headers;

  const upstream = await fetch(`${backendBaseUrl()}/notes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
    cache: "no-store",
  });

  return new Response(null, { status: upstream.status });
}


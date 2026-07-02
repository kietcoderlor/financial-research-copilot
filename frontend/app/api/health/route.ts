import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(`${backendBaseUrl()}/health`, {
      method: "GET",
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        version: "0.1.0",
        degraded: true,
        dependencies: { db: "unknown", redis: "unknown", aws: "error" },
      },
      { status: 200 },
    );
  }
}


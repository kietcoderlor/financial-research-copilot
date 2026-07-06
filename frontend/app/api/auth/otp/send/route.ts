import { NextResponse } from "next/server";

import { authServiceUnavailableMessage, parseJsonResponse } from "@/lib/apiJson";
import { backendBaseUrl } from "@/lib/backend";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const upstream = await fetch(`${backendBaseUrl()}/auth/otp/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await parseJsonResponse(upstream);
    if (data) {
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(
      { detail: authServiceUnavailableMessage(upstream.status) },
      { status: upstream.ok ? 502 : upstream.status || 502 },
    );
  } catch {
    return NextResponse.json({ detail: authServiceUnavailableMessage(503) }, { status: 503 });
  }
}

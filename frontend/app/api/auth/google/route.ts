import { NextResponse } from "next/server";

import { authServiceUnavailableMessage, parseJsonResponse } from "@/lib/apiJson";
import { backendBaseUrl } from "@/lib/backend";
import { jsonWithSessionCookie } from "@/lib/session";
type TokenAuthResponse = {
  access_token?: string;
  user?: unknown;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const upstream = await fetch(`${backendBaseUrl()}/auth/google`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await parseJsonResponse<TokenAuthResponse & { detail?: unknown }>(upstream);
    if (!data) {
      return NextResponse.json(
        { detail: authServiceUnavailableMessage(upstream.status) },
        { status: upstream.ok ? 502 : upstream.status || 502 },
      );
    }

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    if (!data.access_token) {
      return NextResponse.json({ detail: "Missing access token from auth service." }, { status: 502 });
    }

    return jsonWithSessionCookie(data.access_token, { user: data.user });  } catch {
    return NextResponse.json({ detail: authServiceUnavailableMessage(503) }, { status: 503 });
  }
}

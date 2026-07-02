import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session";

export async function backendAuthHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string> | NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  return { Authorization: `Bearer ${token}`, ...extra };
}

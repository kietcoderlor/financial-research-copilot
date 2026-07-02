import { NextResponse } from "next/server";

import { fetchCurrentUser, getSessionToken } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ user: null });
  }
  const user = await fetchCurrentUser(token);
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user });
}

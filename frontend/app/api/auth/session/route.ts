import { NextResponse } from "next/server";

import { userFromSessionToken } from "@/lib/jwtSession";
import { fetchCurrentUser, getSessionToken } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ user: null });
    }

    const user = await fetchCurrentUser(token);
    if (user) {
      return NextResponse.json({ user });
    }

    const fromToken = await userFromSessionToken(token);
    if (fromToken) {
      return NextResponse.json({ user: fromToken });
    }

    return NextResponse.json({ user: null });
  } catch {
    return NextResponse.json({ user: null });
  }
}

"use server";

import { cookies } from "next/headers";

export async function markMatchesViewed(count: number) {
  const cookieStore = await cookies();
  cookieStore.set("match-count-last-seen", String(count), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

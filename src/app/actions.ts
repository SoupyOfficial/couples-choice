"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/db/schema";

const COOKIE_NAME = "current-user";
const MAX_AGE = 30 * 24 * 60 * 60;


export async function login(userId: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, String(userId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  // Don't redirect from the server action — client handles navigation
  // to avoid mobile race condition where redirect fires before cookie is stored
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(COOKIE_NAME)?.value;
  if (!userId) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(userId)));

  return user ?? null;
}

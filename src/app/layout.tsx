import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { logout, getCurrentUser } from "@/app/actions";
import { db } from "@/db";
import { swipes } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import NavBar from "@/components/layout/NavBar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Couple's Choice — Movie Matchmaker",
  description: "Swipe on movies together and find your perfect match.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f0a2e",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("current-user")?.value;
  const user = await getCurrentUser();
  const emoji = user?.emoji ?? "👤";
  const name = user?.name ?? "User";

  // Compute match count once for both navs
  let newMatchCount = 0;
  if (userId) {
    const lastSeenCount = parseInt(cookieStore.get("match-count-last-seen")?.value || "0");
    const user1Swipes = await db
      .select({ movieId: swipes.movieId, direction: swipes.direction })
      .from(swipes)
      .where(and(eq(swipes.userId, 1), inArray(swipes.direction, ["love", "like", "maybe"])));
    const user2Swipes = await db
      .select({ movieId: swipes.movieId, direction: swipes.direction })
      .from(swipes)
      .where(and(eq(swipes.userId, 2), inArray(swipes.direction, ["love", "like", "maybe"])));

    const user1Map = new Map<number, string>();
    for (const s of user1Swipes) user1Map.set(s.movieId, s.direction);

    const totalMatches = user2Swipes.filter((s) => {
      const user1Dir = user1Map.get(s.movieId);
      if (!user1Dir) return false;
      return (
        user1Dir === "love" ||
        s.direction === "love" ||
        (user1Dir === "like" && s.direction === "like")
      );
    }).length;
    newMatchCount = Math.max(0, totalMatches - lastSeenCount);
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <NavBar className="hidden md:flex" newMatchCount={newMatchCount} user={user} name={name} emoji={emoji} />
        <MobileBottomNav className="md:hidden" newMatchCount={newMatchCount} showPreferences={!user?.extractedPrefs} />
        {children}
      </body>
    </html>
  );
}

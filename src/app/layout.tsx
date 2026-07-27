import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/app/actions";
import { db, dbReady } from "@/db";
import { swipes, users } from "@/db/schema";
import { and, eq, inArray, not } from "drizzle-orm";
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
  if (userId && user) {
    // Ensure DB tables exist before querying
    await dbReady;

    // Find partner ID dynamically (supports both seeded IDs 1/2 and persona-seeded IDs)
    const partnerId = user.id === 1 ? 2 : user.id === 2 ? 1 :
      (await db.select({ id: users.id }).from(users).where(not(eq(users.id, user.id))).limit(1))[0]?.id;

    if (partnerId) {
      const lastSeenCount = parseInt(cookieStore.get("match-count-last-seen")?.value || "0");
      const currentUserSwipes = await db
        .select({ movieId: swipes.movieId, direction: swipes.direction })
        .from(swipes)
        .where(and(eq(swipes.userId, user.id), inArray(swipes.direction, ["love", "like", "maybe"])));
      const partnerSwipes = await db
        .select({ movieId: swipes.movieId, direction: swipes.direction })
        .from(swipes)
        .where(and(eq(swipes.userId, partnerId), inArray(swipes.direction, ["love", "like", "maybe"])));

      const currentUserMap = new Map<number, string>();
      for (const s of currentUserSwipes) currentUserMap.set(s.movieId, s.direction);

      const totalMatches = partnerSwipes.filter((s) => {
        const currentUserDir = currentUserMap.get(s.movieId);
        if (!currentUserDir) return false;
        return (
          currentUserDir === "love" ||
          s.direction === "love" ||
          (currentUserDir === "like" && s.direction === "like")
        );
      }).length;
      newMatchCount = Math.max(0, totalMatches - lastSeenCount);
    }
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <NavBar className="hidden md:flex" newMatchCount={newMatchCount} user={user} name={name} emoji={emoji} />
        <MobileBottomNav className="md:hidden" newMatchCount={newMatchCount} showPreferences={user?.extractedPrefs == null} />
        {children}
      </body>
    </html>
  );
}

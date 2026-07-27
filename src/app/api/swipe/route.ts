import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { swipes, movies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { recordSwipeSignal } from "@/lib/interests/signals";
import { enrichMovie } from "@/lib/llm/enrich-movie";


export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("current-user")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIdNum = Number(userId);
  const body = await request.json();
  const { movieId, direction } = body as {
    movieId: number;
    direction: "love" | "like" | "maybe" | "pass" | "seen" | "skip";
  };

  const VALID_DIRECTIONS = ["love", "like", "maybe", "pass", "seen", "skip"];
  if (
    !movieId ||
    typeof movieId !== "number" ||
    !VALID_DIRECTIONS.includes(direction)
  ) {
    return NextResponse.json(
      { error: "Invalid request body. Expected { movieId: number, direction: 'love' | 'like' | 'maybe' | 'pass' | 'seen' | 'skip' }" },
      { status: 400 }
    );
  }

  try {
    const existing = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, movieId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    // If user previously skipped this movie, remove the skip so they can swipe again
    const existingSwipe = await db
      .select({ direction: swipes.direction })
      .from(swipes)
      .where(and(eq(swipes.userId, userIdNum), eq(swipes.movieId, movieId)))
      .get();

    if (existingSwipe?.direction === "skip") {
      await db
        .delete(swipes)
        .where(and(eq(swipes.userId, userIdNum), eq(swipes.movieId, movieId)));
    }

    const [swipe] = await db
      .insert(swipes)
      .values({
        userId: userIdNum,
        movieId,
        direction,
      })
      .returning();

    if (direction !== "seen" && direction !== "skip" && direction !== "maybe") {
      recordSwipeSignal(userIdNum, movieId, direction).catch(err =>
        console.error('Failed to record interest signals:', err)
      );
    }

    if (direction === "skip") {
      return NextResponse.json({ matched: false, skipped: true });
    }

    if (direction === "pass" || direction === "seen") {
      return NextResponse.json({ matched: false });
    }

    const otherUserId = userIdNum === 1 ? 2 : 1;

    const [otherSwipe] = await db
      .select()
      .from(swipes)
      .where(
        and(
          eq(swipes.userId, otherUserId),
          eq(swipes.movieId, movieId)
        )
      );

    const otherDir = otherSwipe?.direction;
    const isMatch = otherDir && otherDir !== "pass" && otherDir !== "seen" && otherDir !== "skip" && (
      direction === "love" ||
      otherDir === "love" ||
      (direction === "like" && otherDir === "like")
    );

    if (isMatch) {
      const matchQuality = direction === "love" && otherDir === "love" ? "strong" : "standard";
      return NextResponse.json({ matched: true, matchId: otherSwipe.id, matchQuality });
    }

    // Fire-and-forget: LLM enrichment (checks cache internally)
    enrichMovie(movieId).catch(err =>
      console.error('Failed to enrich movie:', err)
    );

    return NextResponse.json({ matched: false });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.toLowerCase().includes("unique constraint") ||
       (err as { cause?: { message?: string } }).cause?.message?.toLowerCase().includes("unique constraint"))
    ) {
      return NextResponse.json(
        { error: "Already swiped on this movie" },
        { status: 409 }
      );
    }
    throw err;
  }
}

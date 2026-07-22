import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { swipes, movies } from "@/db/schema";
import { eq, and } from "drizzle-orm";


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
    direction: string;
  };

  if (
    !movieId ||
    typeof movieId !== "number" ||
    (direction !== "left" && direction !== "right")
  ) {
    return NextResponse.json(
      { error: "Invalid request body. Expected { movieId: number, direction: 'left' | 'right' }" },
      { status: 400 }
    );
  }

  try {
    const existing = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, movieId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    const [swipe] = await db
      .insert(swipes)
      .values({
        userId: userIdNum,
        movieId,
        direction,
      })
      .returning();

    if (direction === "left") {
      return NextResponse.json({ matched: false });
    }

    const otherUserId = userIdNum === 1 ? 2 : 1;

    const [match] = await db
      .select()
      .from(swipes)
      .where(
        and(
          eq(swipes.userId, otherUserId),
          eq(swipes.movieId, movieId),
          eq(swipes.direction, "right")
        )
      );

    if (match) {
      return NextResponse.json({ matched: true, matchId: match.id });
    }

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

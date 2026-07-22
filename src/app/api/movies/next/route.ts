import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { swipes, movies } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getDiscoverMovies, getImageUrl, STREAMING_PROVIDERS, getWatchProviders } from "@/lib/tmdb";


export async function GET(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("current-user")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIdNum = Number(userId);
  const url = new URL(request.url);
  const startPage = Number(url.searchParams.get("page")) || 1;

  const userSwipes = await db
    .select({ movieId: swipes.movieId })
    .from(swipes)
    .where(eq(swipes.userId, userIdNum));

  const swipedMovieIds = new Set(userSwipes.map((s) => s.movieId));

  for (let page = startPage; page <= startPage + 2; page++) {
    const { results: tmdbMovies } = await getDiscoverMovies(page);

    const tmdbIds = tmdbMovies.map((m) => m.tmdbId);

    const existingMovies = await db
      .select()
      .from(movies)
      .where(inArray(movies.tmdbId, tmdbIds));

    const existingTmdbIds = new Set(existingMovies.map((m) => m.tmdbId));

    const toInsert = tmdbMovies.filter((m) => !existingTmdbIds.has(m.tmdbId));

    if (toInsert.length > 0) {
      await db
        .insert(movies)
        .values(
          toInsert.map((m) => ({
            tmdbId: m.tmdbId,
            title: m.title,
            overview: m.overview,
            posterPath: m.posterPath,
            backdropPath: m.backdropPath,
            releaseDate: m.releaseDate,
            voteAverage: m.voteAverage,
          }))
        )
        .onConflictDoNothing();

      for (const m of toInsert) {
        const providerIds = await getWatchProviders(m.tmdbId);
        if (providerIds.length > 0) {
          await db
            .update(movies)
            .set({ providerIds: JSON.stringify(providerIds) })
            .where(eq(movies.tmdbId, m.tmdbId));
        }
      }

      const refreshed = await db
        .select()
        .from(movies)
        .where(inArray(movies.tmdbId, toInsert.map((m) => m.tmdbId)));

      refreshed.forEach((m) => existingTmdbIds.add(m.tmdbId));
    }

    const allMovies = await db
      .select()
      .from(movies)
      .where(inArray(movies.tmdbId, tmdbIds));

    const available = allMovies.filter((m) => !swipedMovieIds.has(m.id));

    if (available.length > 0) {
      const movie = available[0];
      const providerIds = movie.providerIds
        ? JSON.parse(movie.providerIds)
        : [];
      const providers = providerIds
        .map((id: number) => STREAMING_PROVIDERS[id])
        .filter(Boolean);

      const otherUserSwipes = await db
        .select({ direction: swipes.direction, userId: swipes.userId })
        .from(swipes)
        .where(eq(swipes.movieId, movie.id));

      const otherLiked = otherUserSwipes.some(
        (s) => s.userId !== userIdNum && s.direction === "right"
      );

      return NextResponse.json({
        id: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        overview: movie.overview,
        posterUrl: getImageUrl(movie.posterPath, "w500"),
        backdropUrl: getImageUrl(movie.backdropPath, "w780"),
        releaseDate: movie.releaseDate,
        voteAverage: movie.voteAverage,
        providers,
        otherLiked,
      });
    }
  }

  return NextResponse.json(
    { error: "No more movies available" },
    { status: 404 }
  );
}

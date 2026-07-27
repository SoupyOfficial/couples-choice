import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { swipes, movies } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getDiscoverMovies, getImageUrl, STREAMING_PROVIDERS, getWatchProviders } from "@/lib/tmdb";
import { rankCandidates, coldStartScore, type MovieCandidate } from "@/lib/ranking";

function parseJsonArray<T>(val: string | null | undefined): T[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

async function getRecentlyShownMovieIds(userId: number, count: number): Promise<number[]> {
  const recent = await db.select({ movieId: swipes.movieId })
    .from(swipes)
    .where(eq(swipes.userId, userId))
    .orderBy(desc(swipes.createdAt))
    .limit(count);
  return recent.map(r => r.movieId);
}

async function getRecentlyShownGenres(userId: number, count: number): Promise<string[]> {
  const recent = await db.select({ movieId: swipes.movieId })
    .from(swipes)
    .where(eq(swipes.userId, userId))
    .orderBy(desc(swipes.createdAt))
    .limit(count);
  const movieIds = recent.map(r => r.movieId);
  if (movieIds.length === 0) return [];

  const TMDB_GENRE_MAP: Record<number, string> = {
    28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy',
    80: 'crime', 99: 'documentary', 18: 'drama', 10751: 'family',
    14: 'fantasy', 36: 'history', 27: 'horror', 10402: 'music',
    9648: 'mystery', 10749: 'romance', 878: 'sci-fi', 10770: 'tv-movie',
    53: 'thriller', 10752: 'war', 37: 'western',
  };

  const recentMovies = await db.select({ genreIds: movies.genreIds })
    .from(movies)
    .where(inArray(movies.id, movieIds));

  return recentMovies.flatMap(m => {
    const ids = parseJsonArray<number>(m.genreIds);
    return ids.map(id => TMDB_GENRE_MAP[id] || 'unknown').filter(Boolean);
  });
}


export async function GET(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("current-user")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIdNum = Number(userId);
  const url = new URL(request.url);
  const startPage = Number(url.searchParams.get("page")) || 1;
  const viewMode = url.searchParams.get("view-mode");

  const userSwipes = await db
    .select({ movieId: swipes.movieId, direction: swipes.direction })
    .from(swipes)
    .where(eq(swipes.userId, userIdNum));

  const permanentlyExcluded = new Set<number>();
  const skippedMovieIds = new Set<number>();
  const seenMovieIds = new Set<number>();

  for (const s of userSwipes) {
    if (s.direction === "pass" || s.direction === "love" || s.direction === "like" || s.direction === "maybe") {
      permanentlyExcluded.add(s.movieId);
    } else if (s.direction === "seen" && viewMode !== "rewatch") {
      permanentlyExcluded.add(s.movieId);
      seenMovieIds.add(s.movieId);
    } else if (s.direction === "seen") {
      seenMovieIds.add(s.movieId);
    } else if (s.direction === "skip") {
      skippedMovieIds.add(s.movieId);
    }
  }

  const recentSkipSwipes = await db
    .select({ movieId: swipes.movieId })
    .from(swipes)
    .where(eq(swipes.userId, userIdNum))
    .orderBy(desc(swipes.createdAt))
    .limit(50);

  const recentSkippedIds = new Set(
    recentSkipSwipes.filter(s => skippedMovieIds.has(s.movieId)).map(s => s.movieId)
  );

  const swipedMovieIds = new Set([...permanentlyExcluded, ...recentSkippedIds]);

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
      const candidates: MovieCandidate[] = available.map(m => ({
        id: m.id,
        tmdbId: m.tmdbId,
        title: m.title,
        overview: m.overview,
        voteAverage: m.voteAverage,
        voteCount: m.voteCount,
        popularity: m.popularity,
        genreIds: parseJsonArray<number>(m.genreIds),
        llmTags: m.llmTags ? JSON.parse(m.llmTags) : null,
        providerIds: parseJsonArray<number>(m.providerIds),
        releaseDate: m.releaseDate,
        createdAt: m.createdAt instanceof Date ? Math.floor(m.createdAt.getTime() / 1000) : (typeof m.createdAt === 'number' ? m.createdAt : Math.floor(Date.now() / 1000)),
      }));

      let movie: MovieCandidate;
      try {
        const recentlyShown = await getRecentlyShownMovieIds(userIdNum, 10);
        const recentlyShownGenres = await getRecentlyShownGenres(userIdNum, 10);
        const otherUserId = userIdNum === 1 ? 2 : 1;

        const ranked = await rankCandidates(
          userIdNum,
          otherUserId,
          candidates,
          recentlyShown,
          recentlyShownGenres,
          seenMovieIds,
          viewMode
        );

        if (ranked.length === 0) {
          throw new Error("rankCandidates returned empty array");
        }

        movie = ranked[0];
      } catch {
        const scored = candidates.map(c => ({ ...c, score: coldStartScore(c) }));
        scored.sort((a, b) => b.score - a.score);
        movie = scored[0];
      }

      const providerIds = movie.providerIds.length > 0
        ? movie.providerIds
        : (available.find(a => a.id === movie.id)?.providerIds
            ? parseJsonArray<number>(available.find(a => a.id === movie.id)!.providerIds)
            : []);
      const providers = providerIds
        .map((id: number) => STREAMING_PROVIDERS[id])
        .filter(Boolean);

      const otherUserSwipes = await db
        .select({ direction: swipes.direction, userId: swipes.userId })
        .from(swipes)
        .where(eq(swipes.movieId, movie.id));

      const otherLiked = otherUserSwipes.some(
        (s) => s.userId !== userIdNum && (s.direction === "love" || s.direction === "like")
      );

      const partnerSwipe = otherUserSwipes.find(
        (s) => s.userId !== userIdNum
      );
      const otherSwiped = partnerSwipe?.direction ?? null;

      return NextResponse.json({
        id: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        overview: movie.overview,
        posterUrl: getImageUrl(available.find(a => a.id === movie.id)?.posterPath ?? "", "w500"),
        backdropUrl: getImageUrl(available.find(a => a.id === movie.id)?.backdropPath ?? "", "w780"),
        releaseDate: movie.releaseDate,
        voteAverage: movie.voteAverage,
        providers,
        otherLiked,
        otherSwiped,
      });
    }
  }

  return NextResponse.json(
    { error: "No more movies available" },
    { status: 404 }
  );
}

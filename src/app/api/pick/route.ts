import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { movies, swipes, users } from "@/db/schema";
import { eq, and, inArray, desc, not, sql } from "drizzle-orm";
import { rankCandidates, coldStartScore } from "@/lib/ranking";
import type { MovieCandidate } from "@/lib/ranking";

function parseJsonArray<T>(val: string | null | undefined): T[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const userIdStr = cookieStore.get("current-user")?.value;
  if (!userIdStr) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number(userIdStr);
  const otherUserId = userId === 1 ? 2 : 1;

  // Read mood params
  const { searchParams } = request.nextUrl;
  const moodParam = searchParams.get("mood");
  const avoidParam = searchParams.get("avoid");
  const viewMode = searchParams.get("view-mode");
  const moodTerms = moodParam ? moodParam.split(",").filter(Boolean) : [];

  // Get already-swiped movies to exclude
  const userSwipes = await db.select({ movieId: swipes.movieId, direction: swipes.direction })
    .from(swipes).where(eq(swipes.userId, userId));
  const excludedIds = new Set(
    userSwipes
      .filter(s => s.direction !== "skip" && (viewMode !== "rewatch" || s.direction !== "seen"))
      .map(s => s.movieId)
  );

  // Get available movies
  const allMovies = await db.select().from(movies).orderBy(desc(movies.popularity)).limit(50);
  const candidates: MovieCandidate[] = allMovies
    .filter(m => !excludedIds.has(m.id))
    .map(m => ({
      id: m.id, tmdbId: m.tmdbId, title: m.title, overview: m.overview,
      voteAverage: m.voteAverage, voteCount: m.voteCount, popularity: m.popularity,
      genreIds: parseJsonArray<number>(m.genreIds),
      llmTags: m.llmTags ? JSON.parse(m.llmTags) : null,
      providerIds: parseJsonArray<number>(m.providerIds),
      releaseDate: m.releaseDate,
      createdAt: typeof m.createdAt === 'number' ? m.createdAt : (m.createdAt as Date).getTime() / 1000,
    }));

  // Apply mood boost/penalty
  const TMDB_GENRE_MAP: Record<number, string> = {
    28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy',
    80: 'crime', 99: 'documentary', 18: 'drama', 10751: 'family',
    14: 'fantasy', 36: 'history', 27: 'horror', 10402: 'music',
    9648: 'mystery', 10749: 'romance', 878: 'sci-fi', 10770: 'tv-movie',
    53: 'thriller', 10752: 'war', 37: 'western',
  };

  // Rank them
  let ranked: MovieCandidate[];
  try {
    ranked = await rankCandidates(userId, otherUserId, candidates, [], []);
  } catch {
    ranked = candidates.map(c => ({ ...c, score: coldStartScore(c) } as any));
    ranked.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
  }

  // Apply mood filters as boost/penalty
  const boosted = ranked.map(m => {
    let boost = 1.0;
    const genres = m.genreIds.map(id => TMDB_GENRE_MAP[id] || 'unknown');
    const vibes = m.llmTags?.vibes || [];
    
    for (const term of moodTerms) {
      if (genres.includes(term.toLowerCase()) || vibes.includes(term.toLowerCase())) {
        boost *= 1.5;
      }
    }
    if (avoidParam) {
      for (const term of avoidParam.split(",")) {
        if (genres.includes(term.toLowerCase()) || vibes.includes(term.toLowerCase())) {
          boost *= 0.2;
        }
      }
    }
    return { ...m, boost };
  });
  boosted.sort((a, b) => (b as any).score * b.boost - (a as any).score * a.boost);

  // Get poster URLs and provider names from movie data
  const STREAMING_PROVIDERS: Record<number, string> = {
    8: "Netflix", 9: "Prime", 337: "Disney+", 384: "Max",
    15: "Hulu", 350: "Apple TV+", 386: "Peacock", 531: "Paramount+",
  };

  const results = boosted.slice(0, 12).map(m => ({
    id: m.id,
    tmdbId: m.tmdbId,
    title: m.title,
    overview: m.overview?.slice(0, 120) || null,
    posterUrl: allMovies.find(am => am.id === m.id)?.posterPath
      ? `https://image.tmdb.org/t/p/w500${allMovies.find(am => am.id === m.id)!.posterPath}`
      : null,
    voteAverage: m.voteAverage,
    providers: m.providerIds.map(id => STREAMING_PROVIDERS[id] || "").filter(Boolean),
    matchScore: Math.round(((m as any).score || 0.5) * 100),
    whyRecommendation: m.llmTags?.vibes?.slice(0, 2).join(", ") || "Popular pick",
  }));

  return NextResponse.json({ movies: results });
}

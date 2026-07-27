import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { movies, swipes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getImageUrl,
  STREAMING_PROVIDERS,
  getMovieDetail,
  getMovieCredits,
  getMovieReviews,
  type MovieCastMember,
  type MovieReview,
} from "@/lib/tmdb";
import type { MovieTags } from "@/lib/llm/enrich-movie";

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

function parseJsonArray<T>(val: string | null | undefined): T[] {
  if (!val) return [];
  try {
    return JSON.parse(val) as T[];
  } catch {
    return [];
  }
}

interface Tier1Response {
  id: number;
  tmdbId: number;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  genres: string[];
  llmTags: MovieTags | null;
  providers: string[];
  otherSwiped: string | null;
  otherUserName: string | null;
  // Tier 2 — null until enriched
  runtime: number | null;
  tagline: string | null;
  cast: MovieCastMember[];
  director: string | null;
  reviews: MovieReview[];
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("current-user")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIdNum = Number(userId);
  const { id } = await context.params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId) || movieId <= 0) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const enrich = url.searchParams.get("enrich") === "true";

  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId));

  if (!movie) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  const otherUserId = userIdNum === 1 ? 2 : 1;
  const otherUserName = otherUserId === 1 ? "Jacob" : "Ashley";

  const [otherSwipe] = await db
    .select({ direction: swipes.direction })
    .from(swipes)
    .where(
      and(eq(swipes.userId, otherUserId), eq(swipes.movieId, movieId)),
    );

  const genreIds = parseJsonArray<number>(movie.genreIds);
  const genres = genreIds
    .map((gid) => TMDB_GENRE_MAP[gid])
    .filter((g): g is string => Boolean(g));

  let llmTags: MovieTags | null = null;
  if (movie.llmTags) {
    try {
      llmTags = JSON.parse(movie.llmTags) as MovieTags;
    } catch {
      llmTags = null;
    }
  }

  const providerIds = parseJsonArray<number>(movie.providerIds);
  const providers = providerIds
    .map((pid) => STREAMING_PROVIDERS[pid])
    .filter((p): p is string => Boolean(p));

  const tier1: Tier1Response = {
    id: movie.id,
    tmdbId: movie.tmdbId,
    title: movie.title,
    overview: movie.overview,
    posterUrl: getImageUrl(movie.posterPath, "w500"),
    backdropUrl: getImageUrl(movie.backdropPath, "w780"),
    releaseDate: movie.releaseDate,
    voteAverage: movie.voteAverage,
    voteCount: movie.voteCount,
    genres,
    llmTags,
    providers,
    otherSwiped: otherSwipe?.direction ?? null,
    otherUserName,
    runtime: null,
    tagline: null,
    cast: [],
    director: null,
    reviews: [],
  };

  if (!enrich) {
    return NextResponse.json(tier1);
  }

  const [detail, credits, reviews] = await Promise.all([
    getMovieDetail(movie.tmdbId),
    getMovieCredits(movie.tmdbId),
    getMovieReviews(movie.tmdbId),
  ]);

  return NextResponse.json({
    ...tier1,
    runtime: detail.runtime,
    tagline: detail.tagline,
    cast: credits.cast,
    director: credits.director,
    reviews,
  });
}
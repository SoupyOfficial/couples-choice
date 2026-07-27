import { db } from "@/db";
import { swipes, interestSignals } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MovieTags {
  vibes?: string[];
  emotionalTone?: string[];
  pacing?: string;
  themes?: string[];
}

export interface MovieCandidate {
  id: number;
  tmdbId: number;
  title: string;
  overview: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  genreIds: number[];
  llmTags: MovieTags | null;
  providerIds: number[];
  releaseDate: string | null;
  createdAt: number;
}

export interface TasteProfile {
  genres: Record<string, { affinity: number; confidence: number }>;
  vibes: Record<string, { affinity: number; confidence: number }>;
  emotionalTones: Record<string, { affinity: number; confidence: number }>;
  totalSignals: number;
}

export interface RankingWeights {
  bayesianRating: number;
  popularity: number;
  genreAffinity: number;
  vibeAffinity: number;
  partnerLikelihood: number;
  recencyDecay: number;
  diversityBonus: number;
  seenMovieBonus: number;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  bayesianRating: 0.20,
  popularity: 0.15,
  genreAffinity: 0.25,
  vibeAffinity: 0.15,
  partnerLikelihood: 0.15,
  recencyDecay: 0.05,
  diversityBonus: 0.05,
  seenMovieBonus: 0.05,
};

// ── TMDB Genre Map ───────────────────────────────────────────────────────────

export const TMDB_GENRE_MAP: Record<number, string> = {
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
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min));
}

// ── Bayesian Rating ──────────────────────────────────────────────────────────

const BAYESIAN_C = 7.0;
const BAYESIAN_M = 200;

export function bayesianRating(
  rating: number | null,
  votes: number | null,
): number {
  if (rating === null || votes === null) return 0.5;

  const bayesian = (rating * votes + BAYESIAN_C * BAYESIAN_M) / (votes + BAYESIAN_M);
  return clamp((bayesian - 1) / 9);
}

// ── Genre Affinity ───────────────────────────────────────────────────────────

export function genreAffinity(
  movie: MovieCandidate,
  profile: TasteProfile | null,
): number {
  if (!profile || Object.keys(profile.genres).length === 0) return 0.5;

  const movieGenres = movie.genreIds
    .map((id) => TMDB_GENRE_MAP[id])
    .filter((name): name is string => name !== undefined);

  if (movieGenres.length === 0) return 0.3;

  let totalAffinity = 0;
  let totalConfidence = 0;

  for (const genre of movieGenres) {
    const entry = profile.genres[genre];
    if (entry) {
      totalAffinity += entry.affinity * entry.confidence;
      totalConfidence += entry.confidence;
    }
  }

  if (totalConfidence === 0) return 0.3;

  return clamp(totalAffinity / totalConfidence);
}

// ── Vibe Affinity ────────────────────────────────────────────────────────────

export function vibeAffinity(
  movie: MovieCandidate,
  profile: TasteProfile | null,
): number {
  if (!profile || Object.keys(profile.vibes).length === 0) return 0.5;

  const tags = movie.llmTags;
  if (!tags) return 0.5;

  const movieVibes: string[] = [
    ...(tags.vibes ?? []),
    ...(tags.emotionalTone ?? []),
  ];

  if (movieVibes.length === 0) return 0.5;

  let totalAffinity = 0;
  let totalConfidence = 0;

  for (const vibe of movieVibes) {
    const entry = profile.vibes[vibe];
    if (entry) {
      totalAffinity += entry.affinity * entry.confidence;
      totalConfidence += entry.confidence;
    }
  }

  if (totalConfidence === 0) return 0.5;

  return clamp(totalAffinity / totalConfidence);
}

// ── Partner Likelihood ───────────────────────────────────────────────────────

export function partnerLikelihood(
  movie: MovieCandidate,
  partnerProfile: TasteProfile | null,
  partnerSwipedMovieIds: Set<number>,
  partnerRightSwipedIds: Set<number>,
): number {
  if (partnerRightSwipedIds.has(movie.id)) return 1.0;
  if (partnerSwipedMovieIds.has(movie.id)) return 0.0;
  if (!partnerProfile) return 0.5;

  const genreScore = genreAffinity(movie, partnerProfile);
  const vibeScore = vibeAffinity(movie, partnerProfile);

  return clamp(0.6 * genreScore + 0.4 * vibeScore);
}

// ── Recency Score ────────────────────────────────────────────────────────────

export function recencyScore(
  movieId: number,
  recentlyShownMovieIds: number[],
): number {
  const index = recentlyShownMovieIds.indexOf(movieId);
  if (index === -1) return 1.0;

  const position = index;
  if (position >= 10) return 1.0;

  return 0.2 + (0.7 * (9 - position)) / 9;
}

// ── Diversity Score ──────────────────────────────────────────────────────────

export function diversityScore(
  movie: MovieCandidate,
  recentlyShownGenres: string[],
): number {
  const movieGenreNames = movie.genreIds
    .map((id) => TMDB_GENRE_MAP[id])
    .filter((name): name is string => name !== undefined);

  if (movieGenreNames.length === 0) return 0.8;

  const overlap = movieGenreNames.filter((g) => recentlyShownGenres.includes(g)).length;

  if (overlap > 2) return 0.5;
  if (overlap === 0) return 1.0;

  return clamp(1.0 - overlap * 0.15);
}

export function seenMovieMultiplier(
  movieId: number,
  seenMovieIds: Set<number>,
  viewMode: string | null,
): number {
  if (!seenMovieIds.has(movieId)) return 1.0;
  if (viewMode === "rewatch") return 1.5;
  if (viewMode === "new") return 0.3;
  return 1.0;
}

// ── Cold Start Score ─────────────────────────────────────────────────────────

export function coldStartScore(movie: MovieCandidate): number {
  const popularityNorm = normalize(movie.popularity ?? 0, 0, 1000);
  const bayesian = bayesianRating(movie.voteAverage, movie.voteCount);

  return clamp(0.6 * popularityNorm + 0.4 * bayesian);
}

// ── Profile Fetcher ──────────────────────────────────────────────────────────

async function getUserTasteProfile(userId: number): Promise<TasteProfile | null> {
  const signals = await db
    .select({
      dimension: interestSignals.dimension,
      value: interestSignals.dimensionValue,
      signal: interestSignals.signal,
    })
    .from(interestSignals)
    .where(eq(interestSignals.userId, userId));

  if (signals.length === 0) return null;

  const genres: Record<string, { affinity: number; confidence: number }> = {};
  const vibes: Record<string, { affinity: number; confidence: number }> = {};
  const emotionalTones: Record<string, { affinity: number; confidence: number }> = {};

  for (const s of signals) {
    const entry = {
      affinity: s.signal > 0 ? 0.8 : 0.2,
      confidence: Math.min(1, Math.abs(s.signal) / 5),
    };

    if (s.dimension === "genre") {
      genres[s.value] = entry;
    } else if (s.dimension === "vibe") {
      vibes[s.value] = entry;
    } else if (s.dimension === "emotionalTone") {
      emotionalTones[s.value] = entry;
    }
  }

  return {
    genres,
    vibes,
    emotionalTones,
    totalSignals: signals.length,
  };
}

async function getPartnerSwipeData(
  partnerId: number,
): Promise<{ swipedIds: Set<number>; rightSwipedIds: Set<number> }> {
  const partnerSwipes = await db
    .select({ movieId: swipes.movieId, direction: swipes.direction })
    .from(swipes)
    .where(eq(swipes.userId, partnerId));

  const swipedIds = new Set<number>();
  const rightSwipedIds = new Set<number>();

  for (const s of partnerSwipes) {
    swipedIds.add(s.movieId);
    if (s.direction === "love" || s.direction === "like") {
      rightSwipedIds.add(s.movieId);
    }
  }

  return { swipedIds, rightSwipedIds };
}

// ── Main Ranking Function ────────────────────────────────────────────────────

export async function rankCandidates(
  userId: number,
  partnerId: number,
  candidates: MovieCandidate[],
  recentlyShownMovieIds: number[],
  recentlyShownGenres: string[],
  seenMovieIds: Set<number> = new Set(),
  viewMode: string | null = null,
  weights: RankingWeights = DEFAULT_WEIGHTS,
): Promise<MovieCandidate[]> {
  const [userProfile, partnerSwipeData] = await Promise.all([
    getUserTasteProfile(userId),
    getPartnerSwipeData(partnerId),
  ]);

  const partnerProfile = await getUserTasteProfile(partnerId);

  const isColdStart = !userProfile || userProfile.totalSignals < 5;

  const scored = candidates.map((movie) => {
    if (isColdStart) {
      return { movie, score: coldStartScore(movie) };
    }

    const score =
      weights.bayesianRating * bayesianRating(movie.voteAverage, movie.voteCount) +
      weights.popularity * normalize(movie.popularity ?? 0, 0, 1000) +
      weights.genreAffinity * genreAffinity(movie, userProfile) +
      weights.vibeAffinity * vibeAffinity(movie, userProfile) +
      weights.partnerLikelihood *
        partnerLikelihood(movie, partnerProfile, partnerSwipeData.swipedIds, partnerSwipeData.rightSwipedIds) +
      weights.recencyDecay * recencyScore(movie.id, recentlyShownMovieIds) +
      weights.diversityBonus * diversityScore(movie, recentlyShownGenres) +
      weights.seenMovieBonus * seenMovieMultiplier(movie.id, seenMovieIds, viewMode);

    return { movie, score: clamp(score) };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.movie);
}

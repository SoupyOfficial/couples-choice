import { db } from "@/db";
import { movies, interestSignals } from "@/db/schema";
import { eq } from "drizzle-orm";

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "action",
  12: "adventure",
  16: "animation",
  35: "comedy",
  80: "crime",
  99: "documentary",
  18: "drama",
  10751: "family",
  14: "fantasy",
  36: "history",
  27: "horror",
  10402: "music",
  9648: "mystery",
  10749: "romance",
  878: "sci-fi",
  10770: "tv-movie",
  53: "thriller",
  10752: "war",
  37: "western",
};

const DIRECTION_SIGNAL: Record<string, number> = {
  love: 3,
  like: 1,
  maybe: 0,
  pass: -1,
};

function getDecadeBucket(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return null;
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

export async function recordSwipeSignal(
  userId: number,
  movieId: number,
  direction: string,
): Promise<void> {
  if (direction === "skip" || direction === "seen" || direction === "maybe") return;

  const signalValue = DIRECTION_SIGNAL[direction];
  if (signalValue === undefined || signalValue === 0) return;

  const [movie] = await db
    .select({
      genreIds: movies.genreIds,
      llmTags: movies.llmTags,
      releaseDate: movies.releaseDate,
    })
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!movie) return;

  const inserts: {
    userId: number;
    movieId: number;
    dimension: string;
    dimensionValue: string;
    signal: number;
  }[] = [];

  const genreIdsRaw: number[] = movie.genreIds
    ? JSON.parse(movie.genreIds)
    : [];
  for (const id of genreIdsRaw) {
    const genreName = TMDB_GENRE_MAP[id];
    if (genreName) {
      inserts.push({
        userId,
        movieId,
        dimension: "genre",
        dimensionValue: genreName,
        signal: signalValue,
      });
    }
  }

  const tags: Record<string, unknown> = movie.llmTags
    ? JSON.parse(movie.llmTags)
    : {};

  const vibes = tags.vibes as string[] | undefined;
  if (Array.isArray(vibes)) {
    for (const v of vibes) {
      if (typeof v === "string") {
        inserts.push({
          userId,
          movieId,
          dimension: "vibe",
          dimensionValue: v.toLowerCase(),
          signal: signalValue,
        });
      }
    }
  }

  const pace = tags.pace as string | undefined;
  if (typeof pace === "string" && pace) {
    inserts.push({
      userId,
      movieId,
      dimension: "pace",
      dimensionValue: pace.toLowerCase(),
      signal: signalValue,
    });
  }

  const emotionalTone = tags.emotionalTone as string | string[] | undefined;
  if (typeof emotionalTone === "string" && emotionalTone) {
    inserts.push({
      userId,
      movieId,
      dimension: "emotionalTone",
      dimensionValue: emotionalTone.toLowerCase(),
      signal: signalValue,
    });
  } else if (Array.isArray(emotionalTone)) {
    for (const t of emotionalTone) {
      if (typeof t === "string") {
        inserts.push({
          userId,
          movieId,
          dimension: "emotionalTone",
          dimensionValue: t.toLowerCase(),
          signal: signalValue,
        });
      }
    }
  }

  const era = getDecadeBucket(movie.releaseDate);
  if (era) {
    inserts.push({
      userId,
      movieId,
      dimension: "era",
      dimensionValue: era,
      signal: signalValue,
    });
  }

  if (inserts.length === 0) return;

  await db.insert(interestSignals).values(inserts);
}

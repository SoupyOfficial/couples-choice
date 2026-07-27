import { getCurrentUser } from "@/app/actions";
import { redirect } from "next/navigation";
import { MarkViewed } from "./mark-viewed";
import Link from "next/link";
import { db } from "@/db";
import { movies, swipes } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getImageUrl, STREAMING_PROVIDERS } from "@/lib/tmdb";
import { getProviderColor } from "@/lib/provider-colors";


function getYear(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0];
}

function getProviderName(id: number): string {
  return STREAMING_PROVIDERS[id] ?? `Provider ${id}`;
}

function parseProviderIds(raw: string | null): { id: number; name: string }[] {
  if (!raw) return [];
  try {
    const ids: number[] = JSON.parse(raw);
    return ids
      .filter((id): id is number => typeof id === "number")
      .map((id) => ({ id, name: getProviderName(id) }));
  } catch {
    return [];
  }
}

function MovieCard({
  movie,
  matchQuality,
}: {
  movie: {
    tmdbId: number;
    title: string;
    posterPath: string | null;
    releaseDate: string | null;
    voteAverage: number | null;
    providerIds: string | null;
  };
  matchQuality?: "strong" | "standard";
}) {
  const posterUrl = getImageUrl(movie.posterPath, "w342");
  const year = getYear(movie.releaseDate);
  const providers = parseProviderIds(movie.providerIds);

  return (
    <a
      href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden shadow-lg hover:shadow-xl hover:border-white/20 transition-all duration-300"
    >
      <div className="aspect-[2/3] overflow-hidden bg-white/5 relative">
        {matchQuality && (
          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold text-white ${matchQuality === "strong" ? "bg-pink-500" : "bg-brand"}`}>
            {matchQuality === "strong" ? "Strong Match 💕" : "Match"}
          </div>
        )}
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-5xl">
            🎬
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white truncate">
          {movie.title}
        </h3>
        <div className="flex items-center gap-3 text-sm text-white/60 mt-1">
          {year && <span>{year}</span>}
          {movie.voteAverage && movie.voteAverage > 0 && (
            <span>⭐ {movie.voteAverage.toFixed(1)}</span>
          )}
        </div>
        {providers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {providers.map((p) => (
              <span
                key={p.id}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getProviderColor(p.name)}`}
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

export default async function MatchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // db imported at top;

  const user1Swipes = await db
    .select({ movieId: swipes.movieId, direction: swipes.direction })
    .from(swipes)
    .where(and(eq(swipes.userId, 1), inArray(swipes.direction, ["love", "like", "maybe"])));

  const user2Swipes = await db
    .select({ movieId: swipes.movieId, direction: swipes.direction })
    .from(swipes)
    .where(and(eq(swipes.userId, 2), inArray(swipes.direction, ["love", "like", "maybe"])));

  const user1Map = new Map<number, string>();
  for (const s of user1Swipes) {
    user1Map.set(s.movieId, s.direction);
  }

  const matchedEntries: { movieId: number; quality: "strong" | "standard" }[] = [];
  for (const s of user2Swipes) {
    const user1Dir = user1Map.get(s.movieId);
    if (!user1Dir) continue;

    const isMatch =
      user1Dir === "love" ||
      s.direction === "love" ||
      (user1Dir === "like" && s.direction === "like");

    if (isMatch) {
      const quality = user1Dir === "love" && s.direction === "love" ? "strong" : "standard";
      matchedEntries.push({ movieId: s.movieId, quality });
    }
  }

  const matchedIds = matchedEntries.map((e) => e.movieId);
  const matchQualityMap = new Map(matchedEntries.map((e) => [e.movieId, e.quality]));

  let matchedMovies: (typeof movies.$inferSelect & { matchQuality?: "strong" | "standard" })[] = [];
  if (matchedIds.length > 0) {
    const moviesData = await db
      .select()
      .from(movies)
      .where(inArray(movies.id, matchedIds));
    matchedMovies = moviesData.map((m) => ({
      ...m,
      matchQuality: matchQualityMap.get(m.id),
    }));
  }

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="w-full max-w-4xl mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Your Matches 💕
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {matchedMovies.length} movie{matchedMovies.length !== 1 ? "s" : ""} you both love
            </p>
          </div>
          <Link
            href="/swipe"
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand/80 text-white font-medium text-sm transition-all duration-300"
          >
            ← Back to Swiping
          </Link>
        </div>
      </div>

      {/* Content */}
      {matchedMovies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 w-full max-w-4xl">
          <span className="text-5xl mb-4">❤️</span>
          <p className="text-xl font-semibold text-white/80 mb-2">
            No matches yet!
          </p>
          <p className="text-white/50 mb-6 text-sm">
            Keep swiping to find your perfect movie.
          </p>
          <Link
            href="/swipe"
            className="px-6 py-3 rounded-xl bg-brand hover:bg-brand/80 text-white font-medium transition-all duration-300"
          >
            Start Swiping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-4xl">
          {matchedMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} matchQuality={movie.matchQuality} />
          ))}
        </div>
      )}
      <MarkViewed count={matchedIds.length} />
    </main>
  );
}

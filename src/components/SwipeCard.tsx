"use client";

import { useState, useCallback, useEffect } from "react";
import MatchModal from "./MatchModal";

interface Movie {
  id: number;
  tmdbId: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string;
  voteAverage: number;
  providers: string[];
  otherLiked?: boolean;
}

type SwipeDirection = "left" | "right" | null;

const providerColors: Record<string, string> = {
  Netflix: "bg-red-600",
  Prime: "bg-blue-500",
  "Amazon Prime": "bg-blue-500",
  "Disney+": "bg-blue-700",
  Max: "bg-purple-600",
  Hulu: "bg-green-500",
  "Apple+": "bg-gray-500",
  "Apple TV+": "bg-gray-500",
  Peacock: "bg-yellow-500",
  "Paramount+": "bg-blue-400",
};

function getProviderColor(name: string): string {
  return providerColors[name] ?? "bg-slate-600";
}

function truncate(text: string, maxLines: number = 3): string {
  const charsPerLine = 50;
  const maxChars = maxLines * charsPerLine;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "...";
}

function getYear(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0];
}

function SkeletonCard() {
  return (
    <div className="relative w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden animate-pulse">
      <div className="aspect-[16/9] bg-white/5" />
      <div className="p-4 sm:p-6 space-y-3">
        <div className="h-7 bg-white/10 rounded w-3/4" />
        <div className="h-4 bg-white/5 rounded w-1/2" />
        <div className="space-y-2">
          <div className="h-3 bg-white/5 rounded" />
          <div className="h-3 bg-white/5 rounded w-5/6" />
          <div className="h-3 bg-white/5 rounded w-2/3" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-white/10 rounded-full" />
          <div className="h-6 w-20 bg-white/10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
      <span className="text-5xl mb-4">🎬</span>
      <p className="text-xl font-semibold text-white/80 mb-2">No more movies to browse!</p>
      <p className="text-white/50 mb-6 text-sm">Check back later for new suggestions.</p>
      <button
        onClick={onRefresh}
        className="px-6 py-3 rounded-xl bg-brand hover:bg-brand/80 text-white font-medium transition-all duration-300"
      >
        🔄 Load More Movies
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
      <span className="text-5xl mb-4">⚠️</span>
      <p className="text-lg font-semibold text-red-400 mb-2">Something went wrong</p>
      <p className="text-white/50 mb-6 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-300"
      >
        🔄 Retry
      </button>
    </div>
  );
}

export default function SwipeCard() {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);
  const [matchedMovie, setMatchedMovie] = useState<{ title: string; posterUrl: string; providers: string[] } | null>(null);
  const [animating, setAnimating] = useState(false);
  const [page, setPage] = useState(1);

  const fetchMovie = useCallback(async (pageNum?: number) => {
    setLoading(true);
    setError(null);
    setSwipeDirection(null);
    const targetPage = pageNum ?? page;
    try {
      const res = await fetch(`/api/movies/next?page=${targetPage}`);
      if (!res.ok) {
        if (res.status === 404) {
          setMovie(null);
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({ error: "Failed to fetch movie" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: Movie = await res.json();
      setMovie(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchMovie();
  }, [fetchMovie]);

  const handleSwipe = async (direction: "left" | "right") => {
    if (!movie || animating) return;
    setAnimating(true);
    setSwipeDirection(direction);

    try {
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId: movie.id, direction }),
      });
      const data = await res.json();

      if (data.matched) {
        setMatchedMovie({
          title: movie.title,
          posterUrl: movie.posterUrl ?? "",
          providers: movie.providers,
        });
      }
    } catch {
      // Swipe recorded locally even if API fails
    }

    // Wait for animation to complete, then load next
    setTimeout(() => {
      setSwipeDirection(null);
      setAnimating(false);
      fetchMovie();
    }, 400);
  };

  if (loading) {
    return <SkeletonCard />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchMovie} />;
  }

  if (!movie) {
    return <EmptyState onRefresh={() => { setPage((p) => { const nextPage = p + 1; fetchMovie(nextPage); return nextPage; }); }} />;
  }

  const year = getYear(movie.releaseDate);
  const swipeClass =
    swipeDirection === "left"
      ? "-translate-x-full -rotate-12 opacity-0"
      : swipeDirection === "right"
        ? "translate-x-full rotate-12 opacity-0"
        : "translate-x-0 rotate-0 opacity-100";

  return (
    <>
      {/* Movie Card */}
      <div
        className={`relative w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden shadow-2xl transition-all duration-300 ease-out ${swipeClass}`}
      >
        {/* Backdrop Image */}
        {movie.backdropUrl && (
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={movie.backdropUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>
        )}

        {/* Card Content */}
        <div className="p-4 sm:p-6">
          <div className="flex gap-4">
            {/* Poster */}
            {movie.posterUrl && (
              <div className="hidden sm:block flex-shrink-0 w-28 h-40 rounded-lg overflow-hidden shadow-lg border border-white/10">
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                  {movie.title}
                </h2>
                {movie.otherLiked && (
                  <span className="text-xs text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                    ❤️ They liked this!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-white/60 mb-3">
                {year && <span>{year}</span>}
                {movie.voteAverage > 0 && (
                  <span className="flex items-center gap-1">
                    ⭐ {movie.voteAverage.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Overview */}
              {movie.overview && (
                <p className="text-sm text-white/70 leading-relaxed line-clamp-3 mb-3">
                  {truncate(movie.overview)}
                </p>
              )}

              {/* Provider Badges */}
              {movie.providers && movie.providers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {movie.providers.map((provider) => (
                    <span
                      key={provider}
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${getProviderColor(provider)}`}
                    >
                      {provider}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <button
          onClick={() => handleSwipe("left")}
          disabled={animating}
          className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-3xl sm:text-4xl shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Pass"
        >
          ❌
        </button>
        <button
          onClick={() => handleSwipe("right")}
          disabled={animating}
          className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 text-3xl sm:text-4xl shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Like"
        >
          ❤️
        </button>
      </div>

      {/* Match Modal */}
      {matchedMovie && (
        <MatchModal
          movie={matchedMovie}
          onClose={() => setMatchedMovie(null)}
        />
      )}
    </>
  );
}

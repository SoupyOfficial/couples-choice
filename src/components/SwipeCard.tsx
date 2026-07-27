"use client";

import { useState, useCallback, useEffect } from "react";
import MovieDetailModal from "./MovieDetailModal";
import MatchModal from "./MatchModal";
import { getProviderColor } from "@/lib/provider-colors";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

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
  otherSwiped?: string | null;
}

type SwipeDirection = "love" | "like" | "maybe" | "pass" | "seen" | "skip" | null;

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

function partnerBadge(direction: string | null | undefined): { emoji: string; label: string; className: string } | null {
  if (!direction) return null;
  switch (direction) {
    case "love":
      return { emoji: "❤️", label: "They loved this!", className: "bg-rose-500/20 text-rose-300" };
    case "like":
      return { emoji: "👍", label: "They liked this", className: "bg-blue-500/20 text-blue-300" };
    case "maybe":
      return { emoji: "🤷", label: "They're on the fence", className: "bg-amber-500/20 text-amber-300" };
    case "pass":
      return { emoji: "👎", label: "They passed", className: "bg-slate-500/20 text-slate-300" };
    case "seen":
      return { emoji: "👁️", label: "They've seen it", className: "bg-gray-500/20 text-gray-300" };
    case "skip":
      return { emoji: "⏭️", label: "They skipped it", className: "bg-amber-500/20 text-amber-300" };
    default:
      return null;
  }
}

export default function SwipeCard() {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);
  const [animating, setAnimating] = useState(false);
  const [page, setPage] = useState(1);
  const [skipToast, setSkipToast] = useState(false);
  const [matchMovie, setMatchMovie] = useState<{ title: string; posterUrl: string; providers: string[] } | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const fetchMovie = useCallback(async (pageNum?: number) => {
    setLoading(true);
    setError(null);
    setSwipeDirection(null);
    const targetPage = pageNum ?? page;
    try {
      const res = await fetch(`/api/movies/next?page=${targetPage}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
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

  const handleSwipe = async (direction: "love" | "like" | "maybe" | "pass" | "seen" | "skip") => {
    if (!movie || animating) return;
    setAnimating(true);
    setDetailModalOpen(false);
    setSwipeDirection(direction);

    let swipeRecorded = false;
    try {
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId: movie.id, direction }),
      });

      if (!res.ok) {
        // Swipe wasn't recorded — abort and show error
        console.error("Swipe failed:", res.status);
        setError(`Swipe failed (${res.status}). Tap to retry.`);
        setAnimating(false);
        setSwipeDirection(null);
        return;
      }

      const data = await res.json();
      swipeRecorded = true;

      if (data.matched) {
        setMatchMovie({
          title: movie.title,
          posterUrl: movie.posterUrl ?? "",
          providers: movie.providers,
        });
      }
      if (data.skipped) {
        setSkipToast(true);
        setTimeout(() => setSkipToast(false), 2000);
      }
    } catch (err) {
      console.error("Swipe network error:", err);
      setError("Network error. Tap to retry.");
      setAnimating(false);
      setSwipeDirection(null);
      return;
    }

    setTimeout(() => {
      setSwipeDirection(null);
      setAnimating(false);
      if (swipeRecorded) fetchMovie();
    }, 400);
  };

  const handleCardClick = useCallback(() => {
    if (animating || !movie) return;
    setDetailModalOpen(true);
  }, [animating, movie]);

  const { handlers } = useSwipeGesture({
    onSwipe: (direction) => handleSwipe(direction),
    onTap: handleCardClick,
    enabled: !animating && !!movie,
  });

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
    swipeDirection === "pass"
      ? "-translate-x-full -rotate-12 opacity-0"
      : swipeDirection === "like"
        ? "translate-x-full rotate-6 opacity-0"
        : swipeDirection === "love"
          ? "translate-x-full rotate-12 scale-110 opacity-0"
          : swipeDirection === "maybe"
            ? "scale-90 opacity-0"
            : swipeDirection === "seen"
              ? "scale-95 opacity-0"
              : swipeDirection === "skip"
                ? "scale-90 -translate-y-8 opacity-0"
                : "translate-x-0 rotate-0 opacity-100";

  const partner = partnerBadge(movie.otherSwiped);

  return (
    <>
      {/* Movie Card */}
      <div
        {...handlers}
        tabIndex={0}
        role="button"
        aria-label={`${movie.title} — tap for details, swipe to rate`}
        onKeyDown={(e) => {
          if (animating || !movie) return;
          switch (e.key) {
            case "ArrowLeft": e.preventDefault(); handleSwipe("pass"); break;
            case "ArrowRight": e.preventDefault(); handleSwipe("like"); break;
            case "ArrowUp": e.preventDefault(); handleSwipe("love"); break;
            case "ArrowDown": e.preventDefault(); handleSwipe("maybe"); break;
            case "Enter":
            case " ": e.preventDefault(); handleCardClick(); break;
          }
        }}
        className={`group relative w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden shadow-2xl transition-all duration-300 ease-out cursor-pointer hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${swipeClass}`}
        style={{ touchAction: "none" }}
      >
        {/* Backdrop Image */}
        {movie.backdropUrl && (
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={movie.backdropUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                  {movie.title}
                </h2>
                {partner && (
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${partner.className}`}>
                    {partner.emoji} {partner.label}
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

        {/* Tap-for-details indicator */}
        <div className="absolute bottom-2 right-3 text-[10px] uppercase tracking-wider text-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none select-none">
          Tap for details
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {/* Row 1 — primary decisions */}
        <div className="flex items-center justify-center gap-5 sm:gap-7">
          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe("pass"); }}
            disabled={animating}
            className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-2xl sm:text-3xl shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Pass"
          >
            👎
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe("like"); }}
            disabled={animating}
            className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-2xl sm:text-3xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Like"
          >
            👍
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe("love"); }}
            disabled={animating}
            className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 text-2xl sm:text-3xl shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Love"
          >
            ❤️
          </button>
        </div>

        {/* Row 2 — conditional signal */}
        <button
          onClick={(e) => { e.stopPropagation(); handleSwipe("maybe"); }}
          disabled={animating}
          className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-xl sm:text-2xl shadow-lg shadow-amber-500/20 transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Maybe"
        >
          🤷
        </button>

        {/* Row 3 — utilities */}
        <div className="flex items-center justify-between w-full max-w-xs px-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe("seen"); }}
            disabled={animating}
            className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 hover:from-gray-300 hover:to-gray-400 text-lg sm:text-xl shadow-md transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Seen it"
          >
            👁️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSwipe("skip"); }}
            disabled={animating}
            className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-lg sm:text-xl shadow-md transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Skip — show later"
          >
            ⏭️
          </button>
        </div>
      </div>

      {/* Match Modal */}
      {matchMovie && (
        <MatchModal
          movie={matchMovie}
          onClose={() => setMatchMovie(null)}
        />
      )}

      {/* Skip Toast */}
      {skipToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-amber-500/90 backdrop-blur-sm text-white text-sm font-medium rounded-full shadow-lg animate-bounce pb-safe">
          Skipped — may appear again later
        </div>
      )}

      {/* Detail Modal */}
      {detailModalOpen && movie && (
        <MovieDetailModal
          movieId={movie.id}
          movie={{
            title: movie.title,
            overview: movie.overview,
            posterUrl: movie.posterUrl,
            backdropUrl: movie.backdropUrl,
            releaseDate: movie.releaseDate,
            voteAverage: movie.voteAverage,
            providers: movie.providers,
          }}
          otherSwiped={movie.otherSwiped ?? null}
          onClose={() => setDetailModalOpen(false)}
          onSwipe={(direction) => handleSwipe(direction)}
        />
      )}
    </>
  );
}

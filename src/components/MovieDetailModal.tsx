"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getProviderColor } from "@/lib/provider-colors";

interface MovieDetailModalProps {
  movieId: number;
  movie: {
    title: string;
    overview: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    releaseDate: string;
    voteAverage: number;
    providers: string[];
  };
  onClose: () => void;
  onSwipe: (direction: "love" | "like" | "maybe" | "pass") => void;
  otherSwiped: string | null;
}

interface MovieTags {
  vibes: string[];
  pace: "slow-burn" | "steady" | "fast-paced";
  emotionalTone: string[];
  dateNightScore: number;
  contentWarnings: string[];
  similarTo: string[];
}

interface CastMember {
  name: string;
  character: string;
  profilePath: string | null;
}

interface Review {
  author: string;
  content: string;
}

interface DetailsResponse {
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
  runtime: number | null;
  tagline: string | null;
  cast: CastMember[];
  director: string | null;
  reviews: Review[];
}

function getYear(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0];
}

function formatRuntime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-3">
      {children}
    </h3>
  );
}

function partnerStatus(otherSwiped: string | null, otherUserName: string | null): { emoji: string; text: string; className: string } {
  const name = otherUserName ?? "Partner";
  switch (otherSwiped) {
    case "love":
      return { emoji: "❤️", text: `${name} loved this!`, className: "bg-rose-500/15 text-rose-200 border-rose-400/30" };
    case "like":
      return { emoji: "👍", text: `${name} liked this`, className: "bg-blue-500/15 text-blue-200 border-blue-400/30" };
    case "maybe":
      return { emoji: "🤷", text: `${name} is on the fence`, className: "bg-amber-500/15 text-amber-200 border-amber-400/30" };
    case "pass":
      return { emoji: "👎", text: `${name} passed on this`, className: "bg-slate-500/15 text-slate-200 border-slate-400/30" };
    case "seen":
      return { emoji: "👁️", text: `${name} has seen it`, className: "bg-gray-500/15 text-gray-200 border-gray-400/30" };
    case "skip":
      return { emoji: "⏭️", text: `${name} skipped it`, className: "bg-amber-500/15 text-amber-200 border-amber-400/30" };
    default:
      return { emoji: "💭", text: `${name} hasn't swiped yet`, className: "bg-white/5 text-white/50 border-white/10" };
  }
}

export default function MovieDetailModal({
  movieId,
  movie,
  onClose,
  onSwipe,
  otherSwiped,
}: MovieDetailModalProps) {
  const [tier1, setTier1] = useState<DetailsResponse | null>(null);
  const [tier2, setTier2] = useState<Pick<DetailsResponse, "runtime" | "tagline" | "cast" | "director" | "reviews"> | null>(null);
  const [loadingTier1, setLoadingTier1] = useState(true);
  const [loadingTier2, setLoadingTier2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  // Fetch Tier 1 on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingTier1(true);
    fetch(`/api/movies/${movieId}/details`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DetailsResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setTier1(data);
        setLoadingTier1(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoadingTier1(false);
      });
    return () => { cancelled = true; };
  }, [movieId]);

  // Fetch Tier 2 after Tier 1 lands
  useEffect(() => {
    if (!tier1) return;
    let cancelled = false;
    setLoadingTier2(true);
    const t = setTimeout(() => {
      fetch(`/api/movies/${movieId}/details?enrich=true`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<DetailsResponse>;
        })
        .then((data) => {
          if (cancelled) return;
          setTier2({
            runtime: data.runtime,
            tagline: data.tagline,
            cast: data.cast,
            director: data.director,
            reviews: data.reviews,
          });
          setLoadingTier2(false);
        })
        .catch(() => {
          if (cancelled) return;
          setLoadingTier2(false);
        });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [movieId, tier1]);

  // Focus trap + body scroll lock + Escape close
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key === "Tab" && dialog) {
        const nodes = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [handleClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleSwipeAndClose = (direction: "love" | "like" | "maybe" | "pass") => {
    onSwipe(direction);
  };

  const data = tier1;
  const tags = data?.llmTags ?? null;
  const partner = partnerStatus(otherSwiped, data?.otherUserName ?? null);
  const year = getYear(data?.releaseDate ?? movie.releaseDate);
  const runtime = tier2?.runtime ?? null;
  const tagline = tier2?.tagline ?? null;
  const cast = tier2?.cast ?? [];
  const director = tier2?.director ?? null;
  const reviews = tier2?.reviews ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${movie.title} details`}
    >
      <div
        ref={dialogRef}
        className={`relative w-full sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] bg-slate-900/95 sm:rounded-2xl border border-white/10 shadow-2xl overflow-y-auto ${closing ? "animate-[fadeOut_200ms_ease-in]" : "animate-[scaleIn_200ms_ease-out]"}`}
      >
        {/* Header — backdrop + title */}
        <div className="relative h-48 sm:h-64 flex-shrink-0">
          {(data?.backdropUrl ?? movie.backdropUrl) && (
            <img
              src={data?.backdropUrl ?? movie.backdropUrl ?? ""}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white text-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
              {data?.title ?? movie.title}
            </h2>
            {tagline && (
              <p className="text-sm text-white/60 italic mt-1">{tagline}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6 pb-32">
          {loadingTier1 && !data ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">
              <p className="text-lg font-semibold mb-2">Failed to load details</p>
              <p className="text-sm text-white/50">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Quick Facts */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/70">
                {year && <span>{year}</span>}
                {runtime ? (
                  <>
                    <span className="text-white/30">•</span>
                    <span>{formatRuntime(runtime)}</span>
                  </>
                ) : loadingTier2 ? (
                  <>
                    <span className="text-white/30">•</span>
                    <Skeleton className="h-4 w-12" />
                  </>
                ) : null}
                {data.voteAverage != null && data.voteAverage > 0 && (
                  <>
                    <span className="text-white/30">•</span>
                    <span>⭐ {data.voteAverage.toFixed(1)}</span>
                  </>
                )}
                {data.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 w-full mt-1">
                    {data.genres.map((g) => (
                      <Chip key={g} className="bg-white/10 text-white/80">
                        {g}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>

              {/* Full Overview */}
              {data.overview && (
                <div>
                  <SectionTitle>Overview</SectionTitle>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {data.overview}
                  </p>
                </div>
              )}

              {/* Vibe Tags */}
              {tags?.vibes && tags.vibes.length > 0 && (
                <div>
                  <SectionTitle>Vibes</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {tags.vibes.map((v) => (
                      <Chip
                        key={v}
                        className="bg-gradient-to-r from-fuchsia-500/30 to-purple-500/30 text-fuchsia-100 border border-fuchsia-400/20"
                      >
                        {v}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Details: pace, tone, date-night score, warnings */}
              {tags && (
                <div className="space-y-4">
                  <div>
                    <SectionTitle>Pace</SectionTitle>
                    <Chip className="bg-white/10 text-white/80 capitalize">
                      {tags.pace}
                    </Chip>
                  </div>
                  {tags.emotionalTone.length > 0 && (
                    <div>
                      <SectionTitle>Emotional Tone</SectionTitle>
                      <div className="flex flex-wrap gap-2">
                        {tags.emotionalTone.map((t) => (
                          <Chip key={t} className="bg-blue-500/20 text-blue-200">
                            {t}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <SectionTitle>Date Night Score</SectionTitle>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, tags.dateNightScore * 10))}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white/80 tabular-nums">
                        {tags.dateNightScore}/10
                      </span>
                    </div>
                  </div>
                  {tags.contentWarnings.length > 0 && (
                    <div>
                      <SectionTitle>Content Warnings</SectionTitle>
                      <div className="flex flex-wrap gap-2">
                        {tags.contentWarnings.map((w) => (
                          <Chip
                            key={w}
                            className="bg-amber-500/15 text-amber-200 border border-amber-400/20"
                          >
                            ⚠ {w}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Similar To */}
              {tags?.similarTo && tags.similarTo.length > 0 && (
                <div>
                  <SectionTitle>If you liked…</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {tags.similarTo.map((s) => (
                      <Chip key={s} className="bg-white/10 text-white/70 italic">
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Where to Watch */}
              {data.providers.length > 0 && (
                <div>
                  <SectionTitle>Where to Watch</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {data.providers.map((p) => (
                      <span
                        key={p}
                        className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${getProviderColor(p)}`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews (Tier 2) */}
              <div>
                <SectionTitle>Reviews</SectionTitle>
                {loadingTier2 ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ))}
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.map((r, i) => (
                      <blockquote
                        key={i}
                        className="border-l-2 border-white/20 pl-3 py-1"
                      >
                        <p className="text-xs text-white/60 mb-1 font-semibold">
                          — {r.author}
                        </p>
                        <p className="text-sm text-white/70 leading-relaxed">
                          {r.content}
                        </p>
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/40 italic">No reviews yet.</p>
                )}
              </div>

              {/* Cast & Director (Tier 2) */}
              <div>
                <SectionTitle>Cast & Crew</SectionTitle>
                {loadingTier2 ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-3">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-16 w-16 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {director && (
                      <p className="text-sm text-white/70">
                        <span className="text-white/40">Directed by </span>
                        <span className="font-semibold text-white/90">{director}</span>
                      </p>
                    )}
                    {cast.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {cast.map((c) => (
                          <div key={c.name} className="flex flex-col items-center w-16 text-center">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 border border-white/10 mb-1">
                              {c.profilePath && (
                                <img
                                  src={`https://image.tmdb.org/t/p/w185${c.profilePath}`}
                                  alt={c.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-white/80 leading-tight line-clamp-2">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-white/40 leading-tight line-clamp-1">
                              {c.character}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!director && cast.length === 0 && (
                      <p className="text-sm text-white/40 italic">No cast info available.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Partner Status */}
              <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 text-sm ${partner.className}`}>
                <span className="text-lg">{partner.emoji}</span>
                <span className="font-medium">{partner.text}</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Sticky Footer — action buttons */}
        <div className="sticky bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-center gap-3 sm:gap-4 pb-safe">
          <button
            onClick={() => handleSwipeAndClose("pass")}
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-xl sm:text-2xl shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label="Pass"
          >
            👎
          </button>
          <button
            onClick={() => handleSwipeAndClose("like")}
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-xl sm:text-2xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label="Like"
          >
            👍
          </button>
          <button
            onClick={() => handleSwipeAndClose("love")}
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 text-xl sm:text-2xl shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label="Love"
          >
            ❤️
          </button>
          <button
            onClick={() => handleSwipeAndClose("maybe")}
            className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-lg sm:text-xl shadow-lg shadow-amber-500/20 transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label="Maybe"
          >
            🤷
          </button>
        </div>
      </div>
    </div>
  );
}
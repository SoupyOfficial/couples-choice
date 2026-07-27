"use client";

import MoodSelector from "@/components/MoodSelector";
import { useState } from "react";

interface MovieResult {
  id: number;
  tmdbId: number;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  voteAverage: number | null;
  providers: string[];
  matchScore: number;
  whyRecommendation: string;
}

export function PickContent({ userId }: { userId: number }) {
  const [movies, setMovies] = useState<MovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleFind() {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const res = await fetch(`/api/pick?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMovies(data.movies);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-6">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-bold text-white mb-2">Pick a Movie</h1>
        <p className="text-sm text-white/50 mb-6">
          Set your mood and we&apos;ll find something you&apos;ll both love — no swiping needed.
        </p>

        <MoodSelector />

        <div className="mt-6 text-center">
          <button
            onClick={handleFind}
            disabled={loading}
            className="px-8 py-3 rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold text-lg transition-all duration-200 disabled:opacity-50 shadow-lg shadow-brand/20"
          >
            {loading ? "Finding..." : "🎬 Find Movies"}
          </button>
        </div>

        {searched && !loading && movies.length === 0 && (
          <div className="mt-8 text-center text-white/40">
            <p className="text-lg">No movies found for this mood</p>
            <p className="text-sm mt-2">Try adjusting your filters or pick &ldquo;Surprise Me&rdquo;</p>
          </div>
        )}

        {movies.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {movies.map((movie) => (
              <div
                key={movie.id}
                className="group rounded-xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden hover:border-brand/30 transition-all duration-200 hover:scale-[1.02]"
              >
                {movie.posterUrl && (
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full aspect-[2/3] object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-3 space-y-2">
                  <h3 className="font-semibold text-white text-sm leading-tight">
                    {movie.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    {movie.voteAverage && (
                      <span className="text-xs text-yellow-400">★ {movie.voteAverage.toFixed(1)}</span>
                    )}
                    <span className="text-xs text-brand font-medium">
                      {movie.matchScore}% match
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {movie.providers.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/60"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 italic leading-snug">
                    {movie.whyRecommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

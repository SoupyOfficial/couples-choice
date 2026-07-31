"use client";

import { useState } from "react";
import type { User, Movie, Swipe, InterestSignal } from "@/db/schema";
import { getImageUrl, STREAMING_PROVIDERS } from "@/lib/tmdb";
import { getProviderColor } from "@/lib/provider-colors";

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
};

interface DevContentProps {
  users: User[];
  movies: Movie[];
  swipes: Swipe[];
  signals: InterestSignal[];
  errors?: string[];
}

function getYear(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.split("-")[0];
}

function getProviderName(id: number): string {
  return STREAMING_PROVIDERS[id] ?? `Provider ${id}`;
}

function parseJsonArray<T>(val: string | null | undefined): T[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function formatDate(ts: unknown): string {
  if (!ts) return "";
  const d = new Date(ts as string | number | Date);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

const DIRECTION_BADGES: Record<string, string> = {
  love: "bg-pink-500/20 text-pink-300",
  like: "bg-green-500/20 text-green-300",
  maybe: "bg-yellow-500/20 text-yellow-300",
  pass: "bg-red-500/20 text-red-300",
  seen: "bg-blue-500/20 text-blue-300",
  skip: "bg-gray-500/20 text-gray-300",
};

function getUserInfo(userId: number, users: User[]) {
  const u = users.find((x) => x.id === userId);
  return u ? `${u.emoji} ${u.name}` : `User ${userId}`;
}

function getMovieInfo(movieId: number, movies: Movie[]) {
  const m = movies.find((x) => x.id === movieId);
  return m ? `${m.title} (${getYear(m.releaseDate)})` : `Movie ${movieId}`;
}

export function DevContent({ users, movies, swipes, signals, errors = [] }: DevContentProps) {
  const [activeTab, setActiveTab] = useState<"users-movies" | "swipes" | "signals">(
    "users-movies",
  );

  const computedMatches = (() => {
    const user1Swipes = swipes.filter(
      (s) => s.userId === 1 && ["love", "like", "maybe"].includes(s.direction),
    );
    const user2Swipes = swipes.filter(
      (s) => s.userId === 2 && ["love", "like", "maybe"].includes(s.direction),
    );

    const user1Map = new Map<number, string>();
    for (const s of user1Swipes) {
      user1Map.set(s.movieId, s.direction);
    }

    const matches: {
      movie: Movie;
      user1Direction: string;
      user2Direction: string;
      quality: "strong" | "standard";
    }[] = [];

    const seen = new Set<number>();
    for (const s of user2Swipes) {
      if (seen.has(s.movieId)) continue;
      const user1Dir = user1Map.get(s.movieId);
      if (!user1Dir) continue;

      const isMatch =
        user1Dir === "love" ||
        s.direction === "love" ||
        (user1Dir === "like" && s.direction === "like");

      if (isMatch) {
        const quality =
          user1Dir === "love" && s.direction === "love" ? "strong" : "standard";
        const movie = movies.find((m) => m.id === s.movieId);
        if (movie) {
          seen.add(s.movieId);
          matches.push({
            movie,
            user1Direction: user1Dir,
            user2Direction: s.direction,
            quality,
          });
        }
      }
    }
    return matches;
  })();

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 text-center">
          <div className="text-3xl font-bold text-white">{users.length}</div>
          <div className="text-white/60 text-xs mt-1">Total Users</div>
        </div>
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 text-center">
          <div className="text-3xl font-bold text-white">{movies.length}</div>
          <div className="text-white/60 text-xs mt-1">Total Movies</div>
        </div>
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 text-center">
          <div className="text-3xl font-bold text-white">{swipes.length}</div>
          <div className="text-white/60 text-xs mt-1">Total Swipes</div>
        </div>
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 text-center">
          <div className="text-3xl font-bold text-white">{signals.length}</div>
          <div className="text-white/60 text-xs mt-1">Total Signals</div>
        </div>
      </div>

      {/* Error Banner */}
      {errors.length > 0 && (
        <div className="w-full max-w-6xl p-4 rounded-2xl bg-red-500/10 backdrop-blur-md border border-red-500/30">
          <p className="text-red-300 font-semibold mb-2">
            Query Errors &mdash; Some data may be missing
          </p>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((err, i) => (
              <li key={i} className="text-red-200/80 text-sm">{err}</li>
            ))}
          </ul>
          <p className="text-red-300/60 text-xs mt-3">
            Run <code className="text-red-300/80 bg-red-500/10 px-1 rounded">drizzle-kit migrate</code> against this database to create missing tables.
          </p>
        </div>
      )}

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("users-movies")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            activeTab === "users-movies"
              ? "bg-brand text-white"
              : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
          }`}
        >
          Users &amp; Movies
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("swipes")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            activeTab === "swipes"
              ? "bg-brand text-white"
              : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
          }`}
        >
          Swipes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("signals")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            activeTab === "signals"
              ? "bg-brand text-white"
              : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
          }`}
        >
          Signals &amp; Matches
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "users-movies" && (
        <div className="space-y-8">
          {users.length === 0 && errors.some((e) => e.includes("users")) && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm">
              Could not load users &mdash; table may be missing
            </div>
          )}
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              👥 Users ({users.length})
            </h2>
            <div className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="py-2 px-3 text-sm text-left text-white/60">ID</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Emoji</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Name</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Has Preferences</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-white/5">
                      <td className="py-2 px-3 text-sm text-white/80">{u.id}</td>
                      <td className="py-2 px-3 text-sm text-white/80">{u.emoji}</td>
                      <td className="py-2 px-3 text-sm text-white/80">{u.name}</td>
                      <td className="py-2 px-3 text-sm">
                        {u.extractedPrefs ? (
                          <span className="text-green-400">✅</span>
                        ) : (
                          <span className="text-red-400">❌</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {movies.length === 0 && errors.some((e) => e.includes("movies")) && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm">
              Could not load movies &mdash; table may be missing
            </div>
          )}
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              🎬 Movies ({movies.length})
            </h2>
            <div className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="py-2 px-3 text-sm text-left text-white/60">ID</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">TMDB ID</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Poster</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Title</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Year</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Rating</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Providers</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Genres</th>
                  </tr>
                </thead>
                <tbody>
                  {movies.map((m) => {
                    const posterUrl = getImageUrl(m.posterPath, "w92");
                    const providerIds = parseJsonArray<number>(m.providerIds);
                    const genreIds = parseJsonArray<number>(m.genreIds);
                    return (
                      <tr key={m.id} className="border-t border-white/5">
                        <td className="py-2 px-3 text-sm text-white/80">{m.id}</td>
                        <td className="py-2 px-3 text-sm text-white/80">{m.tmdbId}</td>
                        <td className="py-2 px-3 text-sm">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={m.title}
                              className="w-8 h-12 object-cover rounded"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-sm text-white/80 max-w-[200px] truncate">
                          {m.title}
                        </td>
                        <td className="py-2 px-3 text-sm text-white/80">
                          {getYear(m.releaseDate)}
                        </td>
                        <td className="py-2 px-3 text-sm text-white/80">
                          {m.voteAverage != null ? m.voteAverage.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {providerIds.length === 0 ? (
                              <span className="text-white/30">—</span>
                            ) : (
                              providerIds.map((pid) => {
                                const name = getProviderName(pid);
                                return (
                                  <span
                                    key={pid}
                                    className={`px-1.5 py-0.5 rounded text-xs font-medium text-white ${getProviderColor(name)}`}
                                  >
                                    {name}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {genreIds.length === 0 ? (
                              <span className="text-white/30">—</span>
                            ) : (
                              genreIds.map((gid) => (
                                <span
                                  key={gid}
                                  className="px-1.5 py-0.5 rounded text-xs bg-white/10 text-white/60"
                                >
                                  {TMDB_GENRE_MAP[gid] ?? `Genre ${gid}`}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === "swipes" && (
        <div className="space-y-4">
          {swipes.length === 0 && errors.some((e) => e.includes("swipes")) && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm">
              Could not load swipes &mdash; table may be missing
            </div>
          )}
          <section>
          <h2 className="text-lg font-semibold text-white mb-2">
            👆 Swipes ({swipes.length})
          </h2>
          <div className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="py-2 px-3 text-sm text-left text-white/60">ID</th>
                  <th className="py-2 px-3 text-sm text-left text-white/60">User</th>
                  <th className="py-2 px-3 text-sm text-left text-white/60">Movie</th>
                  <th className="py-2 px-3 text-sm text-left text-white/60">Direction</th>
                  <th className="py-2 px-3 text-sm text-left text-white/60">Date</th>
                </tr>
              </thead>
              <tbody>
                {swipes.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2 px-3 text-sm text-white/80">{s.id}</td>
                    <td className="py-2 px-3 text-sm text-white/80">
                      {getUserInfo(s.userId, users)}
                    </td>
                    <td className="py-2 px-3 text-sm text-white/80 max-w-[200px] truncate">
                      {getMovieInfo(s.movieId, movies)}
                    </td>
                    <td className="py-2 px-3 text-sm">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          DIRECTION_BADGES[s.direction] ?? "bg-gray-500/20 text-gray-300"
                        }`}
                      >
                        {s.direction}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-white/60">
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      )}

      {activeTab === "signals" && (
        <div className="space-y-8">
          {signals.length === 0 && errors.some((e) => e.includes("signals")) && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm">
              Could not load signals &mdash; table may be missing
            </div>
          )}
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              📊 Interest Signals ({signals.length})
            </h2>
            <div className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="py-2 px-3 text-sm text-left text-white/60">ID</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">User</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Movie</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Dimension</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Value</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Signal</th>
                    <th className="py-2 px-3 text-sm text-left text-white/60">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((sig) => {
                    const signalLabel =
                      sig.signal > 0 ? "positive" : sig.signal < 0 ? "negative" : "neutral";
                    const signalColor =
                      sig.signal > 0
                        ? "bg-green-500/20 text-green-300"
                        : sig.signal < 0
                          ? "bg-red-500/20 text-red-300"
                          : "bg-gray-500/20 text-gray-300";
                    return (
                      <tr key={sig.id} className="border-t border-white/5">
                        <td className="py-2 px-3 text-sm text-white/80">{sig.id}</td>
                        <td className="py-2 px-3 text-sm text-white/80">
                          {getUserInfo(sig.userId, users)}
                        </td>
                        <td className="py-2 px-3 text-sm text-white/80 max-w-[200px] truncate">
                          {getMovieInfo(sig.movieId, movies)}
                        </td>
                        <td className="py-2 px-3 text-sm text-white/80">{sig.dimension}</td>
                        <td className="py-2 px-3 text-sm text-white/80">{sig.dimensionValue}</td>
                        <td className="py-2 px-3 text-sm">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${signalColor}`}
                          >
                            {signalLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-sm text-white/60">
                          {formatDate(sig.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              💕 Computed Matches ({computedMatches.length})
            </h2>
            {computedMatches.length === 0 ? (
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-8 text-center text-white/50 text-sm">
                No matches computed yet.
              </div>
            ) : (
              <div className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="py-2 px-3 text-sm text-left text-white/60">Movie</th>
                      <th className="py-2 px-3 text-sm text-left text-white/60">Year</th>
                      <th className="py-2 px-3 text-sm text-left text-white/60">
                        {getUserInfo(1, users)}&apos;s Direction
                      </th>
                      <th className="py-2 px-3 text-sm text-left text-white/60">
                        {getUserInfo(2, users)}&apos;s Direction
                      </th>
                      <th className="py-2 px-3 text-sm text-left text-white/60">Match Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedMatches.map((match) => (
                      <tr key={match.movie.id} className="border-t border-white/5">
                        <td className="py-2 px-3 text-sm text-white/80 max-w-[200px] truncate">
                          {match.movie.title}
                        </td>
                        <td className="py-2 px-3 text-sm text-white/80">
                          {getYear(match.movie.releaseDate)}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              DIRECTION_BADGES[match.user1Direction] ?? ""
                            }`}
                          >
                            {match.user1Direction}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-sm">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              DIRECTION_BADGES[match.user2Direction] ?? ""
                            }`}
                          >
                            {match.user2Direction}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {match.quality === "strong" ? (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-pink-500/20 text-pink-300">
                              💕 Strong
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand/20 text-brand">
                              Match
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

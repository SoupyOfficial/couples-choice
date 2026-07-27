import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  preferenceNarrative: text("preference_narrative"),
  extractedPrefs: text("extracted_prefs"),
  prefsExtractedAt: integer("prefs_extracted_at"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const movies = sqliteTable("movies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tmdbId: integer("tmdb_id").notNull().unique(),
  title: text("title").notNull(),
  overview: text("overview"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  releaseDate: text("release_date"),
  voteAverage: real("vote_average"),
  providerIds: text("provider_ids"),
  genreIds: text("genre_ids"),
  popularity: real("popularity"),
  voteCount: integer("vote_count"),
  llmTags: text("llm_tags"),
  llmEnrichedAt: integer("llm_enriched_at"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const swipes = sqliteTable("swipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  movieId: integer("movie_id").notNull().references(() => movies.id),
  direction: text("direction", { enum: ["love", "like", "maybe", "pass", "seen", "skip"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("unique_user_movie_swipe").on(table.userId, table.movieId),
]);

export const interestSignals = sqliteTable("interest_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  movieId: integer("movie_id").notNull().references(() => movies.id),
  dimension: text("dimension").notNull(),
  dimensionValue: text("dimension_value").notNull(),
  signal: integer("signal").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index("idx_interest_signals_user_dim_value").on(table.userId, table.dimension, table.dimensionValue),
  index("idx_interest_signals_user_created").on(table.userId, table.createdAt),
]);

export const llmCache = sqliteTable("llm_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheKey: text("cache_key").notNull().unique(),
  response: text("response").notNull(),
  ttlSeconds: integer("ttl_seconds"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type Movie = typeof movies.$inferSelect;
export type Swipe = typeof swipes.$inferSelect;
export type InterestSignal = typeof interestSignals.$inferSelect;
export type LlmCache = typeof llmCache.$inferSelect;

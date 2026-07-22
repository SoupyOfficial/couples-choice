import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const swipes = sqliteTable("swipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  movieId: integer("movie_id").notNull().references(() => movies.id),
  direction: text("direction", { enum: ["left", "right"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("unique_user_movie_swipe").on(table.userId, table.movieId),
]);

export type User = typeof users.$inferSelect;
export type Movie = typeof movies.$inferSelect;
export type Swipe = typeof swipes.$inferSelect;

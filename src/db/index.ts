import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof createClient>;
  db?: ReturnType<typeof drizzle>;
  initialized?: boolean;
};

const client =
  globalForDb.client ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:./local.db",
  });

if (process.env.NODE_ENV !== "production") globalForDb.client = client;

const dbInstance = drizzle(client, { schema });

export const db = globalForDb.db ?? dbInstance;

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

// Auto-initialize tables and seed data on first DB access
async function initDb() {
  if (globalForDb.initialized) return;
  globalForDb.initialized = true;

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tmdb_id INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        overview TEXT,
        poster_path TEXT,
        backdrop_path TEXT,
        release_date TEXT,
        vote_average REAL,
        provider_ids TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS swipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        movie_id INTEGER NOT NULL REFERENCES movies(id),
        direction TEXT NOT NULL CHECK(direction IN ('left','right')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(user_id, movie_id)
      )
    `);

    const result = await client.execute("SELECT COUNT(*) as count FROM users");
    const count = Number((result.rows[0] as any).count);
    if (count === 0) {
      await client.execute(
        "INSERT INTO users (name, emoji) VALUES ('Jacob', '❤️'), ('Ashley', '💙')"
      );
      console.log("Seeded users: Jacob & Ashley");
    }
    console.log("DB initialized");
  } catch (err) {
    console.error("DB init error:", err);
  }
}

// Trigger initialization (lazy — runs on first import)
initDb();

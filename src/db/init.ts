import { db } from "./index";
import { users } from "./schema";

let initialized = false;

// Access the underlying libsql client for raw SQL
function getRawClient() {
  return (db as any).$client;
}

export async function ensureDbInitialized() {
  if (initialized) return;

  try {
    const client = getRawClient();

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
        direction TEXT NOT NULL CHECK(direction IN ('love','like','maybe','pass','seen','skip')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(user_id, movie_id)
      )
    `);

    const existing = await db.select().from(users).all();
    if (existing.length === 0) {
      await db.insert(users).values([
        { name: "Jacob", emoji: "❤️" },
        { name: "Ashley", emoji: "💙" },
      ]);
      console.log("Seeded users: Jacob & Ashley");
    }

    initialized = true;
    console.log("DB initialized successfully");
  } catch (err) {
    console.error("DB init error:", err);
  }
}

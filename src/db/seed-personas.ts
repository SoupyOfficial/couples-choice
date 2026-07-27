import "dotenv/config";
import { db } from "./index";
import { users, swipes, interestSignals, movies } from "./schema";
import { eq, sql } from "drizzle-orm";

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "action",
  12: "adventure",
  16: "animation",
  35: "comedy",
  80: "crime",
  99: "documentary",
  18: "drama",
  10751: "family",
  14: "fantasy",
  36: "history",
  27: "horror",
  10402: "music",
  9648: "mystery",
  10749: "romance",
  878: "sci-fi",
  10770: "tv-movie",
  53: "thriller",
  10752: "war",
  37: "western",
};

const REVERSE_GENRE_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(TMDB_GENRE_MAP).map(([k, v]) => [v, Number(k)])
);

interface Persona {
  coupleName: string;
  name: string;
  emoji: string;
  narrative: string;
  extractedPrefs: {
    genres: string[];
    yearRange: [number, number];
    moods: string[];
    avoidThemes: string[];
    runtimePref: "under-90" | "90-120" | "120-150" | "epic" | "any";
    languages: string[];
  };
}

const PERSONAS: Persona[] = [
  // Couple 1: "The Classics" (Older Couple)
  {
    coupleName: "The Classics",
    name: "Margaret",
    emoji: "🍷",
    narrative:
      "We grew up on Humphrey Bogart and Audrey Hepburn. Give us something with real dialogue, not explosions. We love a good mystery or a sweeping romance. Nothing with excessive violence or crude language. Subtitles are fine — we loved Parasite.",
    extractedPrefs: {
      genres: ["drama", "romance", "mystery", "war", "western", "history"],
      yearRange: [1940, 2020],
      moods: ["nostalgic", "thought-provoking", "sweeping"],
      avoidThemes: ["excessive violence", "crude humor"],
      runtimePref: "any",
      languages: ["en", "ko", "fr"],
    },
  },
  {
    coupleName: "The Classics",
    name: "Harold",
    emoji: "🎩",
    narrative:
      "I like a film with substance. John Ford, David Lean, that sort of thing. A good war film or a proper Western. Margaret's got me watching foreign films now too. No comic book movies, please.",
    extractedPrefs: {
      genres: ["drama", "war", "western", "history", "mystery"],
      yearRange: [1940, 2020],
      moods: ["nostalgic", "thought-provoking", "sweeping", "tense"],
      avoidThemes: ["superheroes", "crude humor", "excessive violence"],
      runtimePref: "any",
      languages: ["en", "ko", "fr"],
    },
  },
  // Couple 2: "The Anime Twins"
  {
    coupleName: "The Anime Twins",
    name: "Yuki",
    emoji: "🌸",
    narrative:
      "If it's animated and Japanese, I'm in. Studio Ghibli is my happy place. I love slice-of-life, romance anime, and the occasional shonen. Subtitled ONLY — dubs ruin the performance. I'll watch live-action if it's Japanese or Korean cinema.",
    extractedPrefs: {
      genres: ["animation", "romance", "drama", "fantasy"],
      yearRange: [1990, 2026],
      moods: ["heartwarming", "emotional", "whimsical", "nostalgic"],
      avoidThemes: ["english dubs", "live-action anime remakes"],
      runtimePref: "any",
      languages: ["ja", "ko", "en"],
    },
  },
  {
    coupleName: "The Anime Twins",
    name: "Ren",
    emoji: "⚡",
    narrative:
      "Give me Attack on Titan, Evangelion, or Death Note. I like anime with stakes. Also into Korean thrillers like Oldboy. No moe blob shows or cheesy Hollywood remakes of anime.",
    extractedPrefs: {
      genres: ["animation", "action", "thriller", "drama", "science-fiction"],
      yearRange: [1990, 2026],
      moods: ["intense", "mind-bending", "emotional", "dark"],
      avoidThemes: ["english dubs", "live-action anime remakes", "rom-coms"],
      runtimePref: "any",
      languages: ["ja", "ko", "en"],
    },
  },
  // Couple 3: "Sci-Fi + Drama" (Opposites Attract)
  {
    coupleName: "Sci-Fi + Drama",
    name: "Marcus",
    emoji: "🚀",
    narrative:
      "I want my brain to hurt. Inception, Primer, Arrival — the more layers, the better. Hard sci-fi, time travel, AI ethics. I'll tolerate a drama if it has a sci-fi element. No dumb action flicks or romance without a twist.",
    extractedPrefs: {
      genres: ["science-fiction", "thriller", "mystery", "drama"],
      yearRange: [1990, 2026],
      moods: ["mind-bending", "intense", "cerebral", "tense"],
      avoidThemes: ["mindless action", "romance without twist", "superheroes"],
      runtimePref: "any",
      languages: ["en", "ko", "fr"],
    },
  },
  {
    coupleName: "Sci-Fi + Drama",
    name: "Elena",
    emoji: "🎭",
    narrative:
      "I want to feel something. Call Me By Your Name, Marriage Story, Past Lives — films that explore human connection. I like sci-fi only when it's really about people (like Arrival or Eternal Sunshine). No gratuitous violence or mindless action.",
    extractedPrefs: {
      genres: ["drama", "romance", "comedy", "science-fiction"],
      yearRange: [2000, 2026],
      moods: ["heartwarming", "bittersweet", "emotional", "thought-provoking"],
      avoidThemes: ["gratuitous violence", "mindless action", "horror"],
      runtimePref: "90-120",
      languages: ["en", "ko", "fr", "it"],
    },
  },
  // Couple 4: "The Horror Junkies"
  {
    coupleName: "The Horror Junkies",
    name: "Luna",
    emoji: "🔪",
    narrative:
      "A24 horror is my religion. Hereditary, The Witch, Midsommar — horror that means something. I love slow-burn dread, atmospheric horror, and films that stay with you. Also into true crime docs. No jump-scare factories or torture porn.",
    extractedPrefs: {
      genres: ["horror", "thriller", "mystery", "documentary"],
      yearRange: [2000, 2026],
      moods: ["dark", "intense", "atmospheric", "tense", "thought-provoking"],
      avoidThemes: ["jump scares", "torture porn", "rom-coms"],
      runtimePref: "any",
      languages: ["en", "ko", "fr", "ja"],
    },
  },
  {
    coupleName: "The Horror Junkies",
    name: "Damien",
    emoji: "💀",
    narrative:
      "I grew up on Friday the 13th and The Thing. Practical effects over CGI every time. I love Cronenberg body horror and creature features. Luna's been getting me into the artsy stuff. No rom-coms. Ever.",
    extractedPrefs: {
      genres: ["horror", "thriller", "science-fiction", "mystery"],
      yearRange: [1970, 2026],
      moods: ["dark", "intense", "tense", "atmospheric"],
      avoidThemes: ["rom-coms", "musicals", "CGI spectacle"],
      runtimePref: "any",
      languages: ["en", "ko", "fr", "ja"],
    },
  },
  // Couple 5: "The Weekend Warriors"
  {
    coupleName: "The Weekend Warriors",
    name: "Jake",
    emoji: "💪",
    narrative:
      "I've got 2 hours max before I fall asleep on the couch. Give me Mission Impossible, John Wick, or the latest Marvel. High energy, great stunts, doesn't require deep analysis. I want to be entertained, not educated.",
    extractedPrefs: {
      genres: ["action", "adventure", "science-fiction", "comedy"],
      yearRange: [2010, 2026],
      moods: ["fast-paced", "fun", "exciting", "feel-good"],
      avoidThemes: ["slow-burn", "subtitles", "heavy drama"],
      runtimePref: "under-90",
      languages: ["en"],
    },
  },
  {
    coupleName: "The Weekend Warriors",
    name: "Kelly",
    emoji: "🍿",
    narrative:
      "I want to laugh or be thrilled — ideally both. Guardians of the Galaxy, Jumanji, Game Night. Nothing too violent or too serious. We're putting the kids to bed and just want to decompress. Under 2 hours is perfect.",
    extractedPrefs: {
      genres: ["comedy", "action", "adventure", "family", "animation"],
      yearRange: [2010, 2026],
      moods: ["feel-good", "fun", "fast-paced", "light"],
      avoidThemes: ["excessive violence", "heavy drama", "horror", "subtitles"],
      runtimePref: "90-120",
      languages: ["en"],
    },
  },
  // Couple 6: "The Arthouse Pair"
  {
    coupleName: "The Arthouse Pair",
    name: "Simone",
    emoji: "🎬",
    narrative:
      "If it premiered at Cannes or Sundance, I'm interested. I love directors like Wong Kar-wai, Tarkovsky, and Lynne Ramsay. Cinema is art. I'll watch anything in the Criterion Collection. No franchises, no superheroes, no algorithm-generated Netflix content.",
    extractedPrefs: {
      genres: ["drama", "history", "documentary", "romance", "mystery"],
      yearRange: [1960, 2026],
      moods: ["thought-provoking", "atmospheric", "bittersweet", "slow-burn", "cerebral"],
      avoidThemes: ["superheroes", "franchises", "cgi-spectacle"],
      runtimePref: "any",
      languages: ["en", "fr", "ko", "ja", "it", "de", "zh", "es"],
    },
  },
  {
    coupleName: "The Arthouse Pair",
    name: "Adrian",
    emoji: "📖",
    narrative:
      "I love a good literary adaptation or a documentary that changes how I see the world. Errol Morris, Werner Herzog. Also into quiet dramas like Drive My Car and Past Lives. Same as Simone — we don't do blockbusters.",
    extractedPrefs: {
      genres: ["drama", "documentary", "history", "romance"],
      yearRange: [1960, 2026],
      moods: ["thought-provoking", "atmospheric", "bittersweet", "quiet", "cerebral"],
      avoidThemes: ["superheroes", "franchises", "blockbusters", "cgi-spectacle"],
      runtimePref: "any",
      languages: ["en", "fr", "ko", "ja", "it", "de", "zh", "es"],
    },
  },
];

// Deterministic pseudo-random based on seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashPair(a: number, b: number): number {
  return ((a * 73856093) ^ (b * 19349663)) & 0x7fffffff;
}

async function clearTestData() {
  console.log("Clearing existing test data...");
  await db.delete(interestSignals).execute();
  await db.delete(swipes).execute();
  await db.delete(users).execute();
  console.log("Cleared interest_signals, swipes, and users.");
}

async function seedPersonas() {
  await clearTestData();

  console.log("Inserting 12 persona users...");
  const insertedUsers = await db
    .insert(users)
    .values(
      PERSONAS.map((p, i) => ({
        name: p.name,
        emoji: p.emoji,
        preferenceNarrative: p.narrative,
        extractedPrefs: JSON.stringify(p.extractedPrefs),
        prefsExtractedAt: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400 * 7),
      }))
    )
    .returning();

  const userIds = insertedUsers.map((u) => u.id);
  console.log(`Created ${userIds.length} users.`);

  // Fetch all movies
  const allMovies = await db.select().from(movies).all();
  if (allMovies.length === 0) {
    console.warn("No movies in DB. Skipping swipe generation.");
    return;
  }

  console.log(`Found ${allMovies.length} movies. Generating swipes...`);

  let totalSwipes = 0;
  let totalSignals = 0;
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  for (let userIdx = 0; userIdx < PERSONAS.length; userIdx++) {
    const persona = PERSONAS[userIdx];
    const userId = userIds[userIdx];
    const prefs = persona.extractedPrefs;
    const preferredGenreIds = new Set(
      prefs.genres.map((g) => REVERSE_GENRE_MAP[g]).filter(Boolean)
    );

    // Deterministic random for this user
    const rng = seededRandom(hashPair(userId, 42));

    // Shuffle movies deterministically
    const shuffled = [...allMovies].sort((a, b) => {
      const ra = seededRandom(hashPair(a.id, userId))();
      const rb = seededRandom(hashPair(b.id, userId))();
      return ra - rb;
    });

    // Pick ~40 movies for this user
    const targetCount = Math.min(40, shuffled.length);
    const selectedMovies = shuffled.slice(0, targetCount);

    const swipeValues: {
      userId: number;
      movieId: number;
      direction: "like" | "pass";
      createdAt: Date;
    }[] = [];

    const signalValues: {
      userId: number;
      movieId: number;
      dimension: string;
      dimensionValue: string;
      signal: number;
      createdAt: Date;
    }[] = [];

    for (const movie of selectedMovies) {
      const movieGenreIds: number[] = movie.genreIds
        ? JSON.parse(movie.genreIds)
        : [];

      const hasMatchingGenre = movieGenreIds.some((gid: number) =>
        preferredGenreIds.has(gid)
      );

      const r = rng();
      const threshold = hasMatchingGenre ? 0.7 : 0.2;
      const direction: "like" | "pass" = r < threshold ? "like" : "pass";

      // Spread timestamps over 30 days
      const offsetSeconds = Math.floor(rng() * (now - thirtyDaysAgo));
      const createdAt = new Date((thirtyDaysAgo + offsetSeconds) * 1000);

      swipeValues.push({
        userId,
        movieId: movie.id,
        direction,
        createdAt,
      });

      // Generate interest signals for this swipe
      const signalValue = direction === "like" ? 1 : -1;

      for (const gid of movieGenreIds) {
        const genreName = TMDB_GENRE_MAP[gid];
        if (genreName) {
          signalValues.push({
            userId,
            movieId: movie.id,
            dimension: "genre",
            dimensionValue: genreName,
            signal: signalValue,
            createdAt,
          });
        }
      }

      // Parse llm_tags for vibes, pace, emotionalTone
      if (movie.llmTags) {
        try {
          const tags = JSON.parse(movie.llmTags);

          if (Array.isArray(tags.vibes)) {
            for (const v of tags.vibes) {
              if (typeof v === "string") {
                signalValues.push({
                  userId,
                  movieId: movie.id,
                  dimension: "vibe",
                  dimensionValue: v.toLowerCase(),
                  signal: signalValue,
                  createdAt,
                });
              }
            }
          }

          if (typeof tags.pace === "string" && tags.pace) {
            signalValues.push({
              userId,
              movieId: movie.id,
              dimension: "pace",
              dimensionValue: tags.pace.toLowerCase(),
              signal: signalValue,
              createdAt,
            });
          }

          if (typeof tags.emotionalTone === "string" && tags.emotionalTone) {
            signalValues.push({
              userId,
              movieId: movie.id,
              dimension: "emotionalTone",
              dimensionValue: tags.emotionalTone.toLowerCase(),
              signal: signalValue,
              createdAt,
            });
          } else if (Array.isArray(tags.emotionalTone)) {
            for (const t of tags.emotionalTone) {
              if (typeof t === "string") {
                signalValues.push({
                  userId,
                  movieId: movie.id,
                  dimension: "emotionalTone",
                  dimensionValue: t.toLowerCase(),
                  signal: signalValue,
                  createdAt,
                });
              }
            }
          }
        } catch {
          // Skip malformed llm_tags
        }
      }

      // Era signal
      if (movie.releaseDate) {
        const year = parseInt(movie.releaseDate.slice(0, 4), 10);
        if (!Number.isNaN(year)) {
          const decade = Math.floor(year / 10) * 10;
          signalValues.push({
            userId,
            movieId: movie.id,
            dimension: "era",
            dimensionValue: `${decade}s`,
            signal: signalValue,
            createdAt,
          });
        }
      }
    }

    // Batch insert swipes
    if (swipeValues.length > 0) {
      // Insert in chunks to avoid SQLite limits
      const chunkSize = 50;
      for (let i = 0; i < swipeValues.length; i += chunkSize) {
        const chunk = swipeValues.slice(i, i + chunkSize);
        await db.insert(swipes).values(chunk).onConflictDoNothing();
      }
      totalSwipes += swipeValues.length;
    }

    // Batch insert signals
    if (signalValues.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < signalValues.length; i += chunkSize) {
        const chunk = signalValues.slice(i, i + chunkSize);
        await db.insert(interestSignals).values(chunk);
      }
      totalSignals += signalValues.length;
    }

    const likeCount = swipeValues.filter((s) => s.direction === "like").length;
    const passCount = swipeValues.filter((s) => s.direction === "pass").length;
    console.log(
      `  ${persona.emoji} ${persona.name}: ${swipeValues.length} swipes (${likeCount} like, ${passCount} pass)`
    );
  }

  console.log("\nDone!");
  console.log(`Users created: ${userIds.length}`);
  console.log(`Swipes created: ${totalSwipes}`);
  console.log(`Interest signals created: ${totalSignals}`);
  console.log("\nCouples seeded:");
  for (let i = 0; i < PERSONAS.length; i += 2) {
    const p1 = PERSONAS[i];
    const p2 = PERSONAS[i + 1];
    console.log(
      `  Couple ${i / 2 + 1}: "${p1.coupleName}" — ${p1.emoji} ${p1.name} + ${p2.emoji} ${p2.name}`
    );
  }
}

seedPersonas().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

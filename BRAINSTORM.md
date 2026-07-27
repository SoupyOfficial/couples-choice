# Couples Choice — Brainstorm & Feature Roadmap

> Date: July 22, 2026
> Purpose: Research findings, algorithm catalog, and prioritized feature roadmap for the couples-choice app.

---

## Executive Summary

Couples Choice is a **Tinder-style movie matchmaker for couples** built on Next.js 16 + React 19 + TypeScript + Drizzle ORM + SQLite (libSQL). Currently it supports two hard-coded users (Jacob / Ashley), binary swipe-left/right on TMDB movies, and a simple set-intersection match. The movie suggestion endpoint (`src/app/api/movies/next/route.ts:83`) returns `available[0]` — the first unswiped movie with **zero ranking, personalization, or scoring**.

**The gap is clear:** every competitor in this space uses some form of taste modeling, ranking, or multi-factor scoring. Our app has none. This document catalogs what competitors do, the mathematical formulas behind effective ranking systems, and a phased roadmap to close the gap.

**Key insight from research:** The best apps don't just find matches — they *rank* matches by predicted mutual enjoyment, learn preferences over time, and adapt to context (time of day, mood, streaming services). We can achieve this with relatively small schema additions and a pure ranking function in `src/lib/ranking.ts`.

---

## Competitive Analysis

### Direct Competitors (Couples/Group Decision Apps)

| App | Core Mechanism | Differentiator |
|-----|---------------|----------------|
| **Hangrily** | Tinder-style restaurant swipes, 3-round matching | Solo/couple/group modes, smart filters (cuisine, price, mood, distance), "highest-scoring match wins" |
| **Swypo** | Room-based swiping with share code | Real-time matching, built-in chat, match history, custom lists |
| **2watch** | Tinder for TV/movies | AI learns taste over time, group matching up to 8, 60-second timer, 20+ streaming services |
| **Matched** (Taste.io) | Taste calculation → swipe → match | Learns taste over time, recommendations from likeminded couples, filter by mood/streaming |
| **TasteRay** | Intersection of two taste profiles (not average) | Handles "horror + comedy loving couple" by finding overlap naturally, 87% match rate in 2 min |
| **Dinelist** | Swipe restaurants, AI consensus | Bayesian scoring system, "4 of 5 people loved this," group decisions in 2 min |
| **Plick** | Binary engine, swipe in sync | Three nests in under a minute, first few swipes silently narrow the deck |
| **Date Night** (Neo4j) | Graph-based movie recommendations | Traverses from two seed movies through shared traits, Cypher graph query with trait weights |
| **Lovetism** | AI date planner from couple journals | Vector database for semantic similarity, Bayesian scoring for place ratings |
| **MyNextDate** | 9-dimensional preference vectors | Cosine similarity search, preference vector weighted by past ratings |
| **Giddy** | Couples app with daily prompts/games | Gamification layer, earn points for real rewards |
| **CoupleCards** | Self-hosted activity card drawer | Personal deck memory (history, ban list), 66 GitHub stars, MIT license |

### Key Takeaways

1. **Taste modeling is table stakes.** Every successful app learns preferences — explicitly (onboarding) or implicitly (from swipes).
2. **Ranking > matching.** Finding a mutual like is easy. Ranking *which* mutual like to watch tonight is the hard problem.
3. **Context matters.** Time of day, mood, streaming services, and recency all influence the "right" choice.
4. **Group mode is a natural extension.** Dinelist, Plick, and 2watch all support 3+ people.
5. **Gamification drives retention.** Streaks, points, daily picks, and challenges keep couples coming back.

---

## 🤖 LLM Integration (Core Multiplier)

### Overview

The LLM is **not a chatbot feature** — it's a reasoning layer that sits between raw TMDB data and the deterministic matching engine. It interprets human intent, enriches structured data with semantic understanding, and generates natural-language explanations — but **never computes scores, weights, or rankings directly**. All math stays in the deterministic layer (pure TypeScript, fully testable, zero hallucination risk).

Think of it this way: the LLM translates between human language and machine parameters. The deterministic layer does the actual decision-making.

### The Split Architecture (Most Important Concept)

```
LLM LAYER (Vercel AI SDK, any provider)
  • Extracts structured preferences from free-text
  • Generates rich descriptive tags for movies
  • Produces human-readable match explanations
  • Maps moods/conversations to filter parameters
  • NEVER emits scores, weights, or rankings
         │  Zod-validated JSON only
         ▼
DETERMINISTIC LAYER (pure TypeScript, no LLM)
  • Multi-factor scoring with Bayesian weights
  • Elo updates from swipe history
  • Borda count consensus aggregation
  • Genre affinity from preference vectors
  • Diversity enforcement & recency decay
```

The boundary is strict: **LLM outputs are always Zod-validated JSON**. If validation fails, retry once, then fall back gracefully. The deterministic layer never trusts raw LLM text.

### LLM Provider: DeepSeek V4 Flash

The app uses **DeepSeek V4 Flash** via the official `@ai-sdk/deepseek` provider for the Vercel AI SDK.

**Why DeepSeek V4 Flash:**
- **Cost**: $0.14/1M input tokens, $0.28/1M output tokens — cheaper than GPT-4o-mini ($0.15/$0.60)
- **Cache discount**: Automatic disk-based prefix caching at $0.0028/1M (98% off) for repeated system prompts
- **Speed**: 83.7 tokens/sec, ~1s time-to-first-token — feels instant
- **Quality**: 79% on SWE-bench Verified, excellent at structured JSON extraction
- **Context**: 1M token window (plenty for rich movie metadata)
- **Native JSON mode**: supports `response_format: { type: "json_object" }`
- **No thinking overhead**: Disable reasoning with `extra_body: {"thinking": {"type": "disabled"}}` for extraction tasks (faster, cheaper)

**Setup:**
```bash
npm install @ai-sdk/deepseek ai
```

```typescript
// src/lib/llm/provider.ts
import { createDeepSeek } from '@ai-sdk/deepseek';

export const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
});

// Non-thinking mode for structured extraction (fastest, cheapest)
export const LLM_MODEL = deepseek('deepseek-v4-flash');
```

For `generateObject()` calls (structured output), we pass `temperature: 0` and use non-thinking mode for deterministic, fast extraction.

### Core LLM Functions (4 Primary + 2 Auxiliary)

#### 1. Movie Enrichment (`src/lib/llm/enrich-movie.ts`)

**When:** Once per movie, lazily when first inserted to DB. Cached permanently.

**Input:** Movie title, overview, release year, TMDB genres, vote average.

**Output:** Rich tags describing vibe, pacing, emotional tone, date-night suitability, content warnings, and similar-to references.

```typescript
// src/lib/llm/enrich-movie.ts
import { z } from 'zod';
import { generateStructured } from './provider';

export const MovieTagsSchema = z.object({
  vibes: z.array(z.string()).max(8),        // ["mind-bending", "cozy", "visually-stunning"]
  pace: z.enum(["slow-burn", "moderate", "fast-paced", "relentless"]),
  emotionalTone: z.array(z.string()).max(5), // ["hopeful", "bittersweet", "tense"]
  dateNightScore: z.number().min(1).max(10), // How good for a date night
  contentWarnings: z.array(z.string()).max(6), // ["gore", "sexual-content", "heavy-themes"]
  similarTo: z.array(z.string()).max(5),     // ["Inception", "The Matrix", "Memento"]
  conversationStarters: z.array(z.string()).max(3), // Post-movie discussion prompts
});

export type MovieTags = z.infer<typeof MovieTagsSchema>;

const ENRICHMENT_PROMPT = `You are a film analyst tagging movies for a couples' date-night app.
Given the movie details below, extract structured tags.

Title: {title}
Overview: {overview}
Year: {year}
Genres: {genres}
TMDB Rating: {voteAverage}/10

Return JSON matching this schema:
- vibes: 4-8 single-word or hyphenated vibe descriptors
- pace: one of "slow-burn", "moderate", "fast-paced", "relentless"
- emotionalTone: 2-5 emotional descriptors
- dateNightScore: 1-10 (how well this works as a date night movie)
- contentWarnings: any content a couple might want to know about
- similarTo: 3-5 well-known movies with similar feel/themes
- conversationStarters: 1-3 questions this movie naturally sparks`;

export async function enrichMovie(
  title: string,
  overview: string,
  year: number,
  genres: string,
  voteAverage: number,
): Promise<MovieTags> {
  const prompt = ENRICHMENT_PROMPT
    .replace('{title}', title)
    .replace('{overview}', overview.slice(0, 500))
    .replace('{year}', String(year))
    .replace('{genres}', genres)
    .replace('{voteAverage}', String(voteAverage));

  return generateStructured(prompt, MovieTagsSchema);
}
```

**Cost:** ~200 tokens input + ~100 tokens output = **$0.00006 per movie**. 1,000 movies = **$0.06 total**.

**Storage:** New `llm_tags` JSON column on `movies` table. Populated fire-and-forget after movie insert.

#### 2. Preference Extraction (`src/lib/llm/extract-preferences.ts`)

**When:** Once during onboarding. Cached permanently unless user re-runs onboarding.

**Input:** User's free-text answer to "What kind of movies do you two love? What do you avoid?"

**Output:** Structured preferences ready for the ranking engine.

```typescript
// src/lib/llm/extract-preferences.ts
import { z } from 'zod';
import { generateStructured } from './provider';

export const ExtractedPrefsSchema = z.object({
  genres: z.array(z.string()).max(10),       // TMDB genre names: ["Sci-Fi", "Thriller"]
  yearRange: z.tuple([z.number(), z.number()]), // [1990, 2024]
  moods: z.array(z.string()).max(8),         // ["cerebral", "cozy", "adrenaline"]
  avoidThemes: z.array(z.string()).max(8),   // ["gore", "romantic-comedy", "subtitles"]
  runtimePref: z.enum(["short", "medium", "long", "any"]),
  languages: z.array(z.string()).max(5),     // ["english", "korean", "japanese"]
  dateNightPriority: z.number().min(1).max(10),
});

export type ExtractedPrefs = z.infer<typeof ExtractedPrefsSchema>;

const EXTRACTION_PROMPT = `Extract structured movie preferences from this user's description.
The user is describing what they and their partner enjoy watching together.

User's description: "{narrative}"

Return JSON with:
- genres: movie genres they mention or imply (use standard TMDB genre names)
- yearRange: [earliest, latest] year range they prefer
- moods: emotional tones or vibes they seek
- avoidThemes: topics, styles, or content they want to skip
- runtimePref: "short" (<90min), "medium" (90-150min), "long" (>150min), or "any"
- languages: preferred languages (default ["english"])
- dateNightPriority: 1-10 how important date-night suitability is to them`;

export async function extractPreferences(
  narrative: string,
): Promise<ExtractedPrefs> {
  return generateStructured(
    EXTRACTION_PROMPT.replace('{narrative}', narrative),
    ExtractedPrefsSchema,
  );
}
```

**Cost:** ~500 tokens input + ~200 output = **$0.00020 per user**. Runs once. Negligible.

**Storage:** New `extracted_prefs` JSON column on `users` table.

#### 3. Match Explanation (`src/lib/llm/explain-match.ts`)

**When:** On-demand when viewing a match. Not cached (each match is unique).

**Input:** Both users' preference profiles, the matched movie's tags + overview, both users' recent swipe history.

**Output:** 1-2 sentence natural explanation of why this movie is a good match.

```typescript
// src/lib/llm/explain-match.ts
import { z } from 'zod';
import { generateStructured } from './provider';

export const MatchExplanationSchema = z.object({
  explanation: z.string().max(300),
  confidence: z.enum(["high", "medium", "low"]),
  keyOverlap: z.string().max(100), // "Both love cerebral sci-fi"
});

export type MatchExplanation = z.infer<typeof MatchExplanationSchema>;

const EXPLANATION_PROMPT = `You explain why this movie is a great match for a couple.
Be specific, reference their actual tastes, and keep it to 1-2 sentences.

{user1}'s taste: {user1Prefs}
{user1} recently liked: {user1RecentLikes}

{user2}'s taste: {user2Prefs}
{user2} recently liked: {user2RecentLikes}

Movie: {movieTitle}
Movie tags: {movieTags}
Overview: {movieOverview}

Write a warm, specific explanation of why they'll both enjoy this movie.
Mention specific overlaps between their tastes and the movie's qualities.`;

export async function explainMatch(
  user1Name: string,
  user1Prefs: string,
  user1RecentLikes: string,
  user2Name: string,
  user2Prefs: string,
  user2RecentLikes: string,
  movieTitle: string,
  movieTags: string,
  movieOverview: string,
): Promise<MatchExplanation> {
  const prompt = EXPLANATION_PROMPT
    .replace('{user1}', user1Name)
    .replace('{user1Prefs}', user1Prefs)
    .replace('{user1RecentLikes}', user1RecentLikes)
    .replace('{user2}', user2Name)
    .replace('{user2Prefs}', user2Prefs)
    .replace('{user2RecentLikes}', user2RecentLikes)
    .replace('{movieTitle}', movieTitle)
    .replace('{movieTags}', movieTags)
    .replace('{movieOverview}', movieOverview.slice(0, 300));

  return generateStructured(prompt, MatchExplanationSchema);
}
```

**Cost:** ~800 tokens input + ~100 output = **$0.00019 per match**. 100 matches = $0.02. Negligible.

#### 4. Mood-to-Filter Mapping (`src/lib/llm/mood-to-filters.ts`)

**When:** On-demand when user types a free-text mood. Cacheable by input hash.

**Input:** Free-text mood like "cozy rainy Sunday, nothing too heavy, maybe something nostalgic."

**Output:** Structured TMDB filter parameters ready for the API.

```typescript
// src/lib/llm/mood-to-filters.ts
import { z } from 'zod';
import { generateStructured } from './provider';

export const MoodFiltersSchema = z.object({
  genreIds: z.array(z.number()).max(5),
  yearGte: z.number().nullable(),
  yearLte: z.number().nullable(),
  voteAverageGte: z.number().min(0).max(10).nullable(),
  sortBy: z.enum([
    "popularity.desc",
    "vote_average.desc",
    "primary_release_date.desc",
    "revenue.desc",
  ]),
  excludeGenreIds: z.array(z.number()).max(3).default([]),
});

export type MoodFilters = z.infer<typeof MoodFiltersSchema>;

const MOOD_PROMPT = `Convert this mood description into TMDB API filter parameters.
Think about what genres, eras, and quality thresholds match this vibe.

Mood: "{mood}"

TMDB Genre ID Reference:
28=Action, 12=Adventure, 16=Animation, 35=Comedy, 80=Crime, 99=Documentary,
18=Drama, 10751=Family, 14=Fantasy, 27=Horror, 9648=Mystery, 10749=Romance,
878=Sci-Fi, 53=Thriller, 10752=War, 37=Western, 10402=Music

Return JSON with genreIds, optional year range, optional minimum rating, sort order, and genres to exclude.`;

export async function moodToFilters(mood: string): Promise<MoodFilters> {
  return generateStructured(
    MOOD_PROMPT.replace('{mood}', mood),
    MoodFiltersSchema,
  );
}
```

**Cost:** ~300 tokens input + ~100 output = **$0.00010 per query**.

#### 5. Conversational Onboarding (Future)

Chat-like flow where the LLM interviews each partner about their taste, asking follow-up questions based on their answers. More engaging than a form, produces richer preference data.

#### 6. Date Night Curation (Future)

"Plan our Friday night" → LLM suggests a movie + mood setting + snack/drink pairing based on both users' profiles, time of day, and recent watch history.

### Database Schema Changes

```sql
-- New columns on movies table
ALTER TABLE movies ADD COLUMN llm_tags TEXT;         -- JSON: { vibes, pace, emotionalTone, dateNightScore, contentWarnings, similarTo, conversationStarters }
ALTER TABLE movies ADD COLUMN llm_enriched_at INTEGER; -- Unix timestamp, NULL if not enriched yet

-- New columns on users table
ALTER TABLE users ADD COLUMN preference_narrative TEXT; -- Raw free-text "what we like"
ALTER TABLE users ADD COLUMN extracted_prefs TEXT;      -- JSON: structured preferences from LLM
ALTER TABLE users ADD COLUMN prefs_extracted_at INTEGER; -- Unix timestamp

-- New table for cached LLM responses (mood-to-filter caching, enrichment dedup)
CREATE TABLE llm_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,   -- SHA-256 hash of (function_name + JSON input)
  response TEXT NOT NULL,           -- JSON response from LLM
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ttl_seconds INTEGER               -- NULL = permanent (enrichment, prefs), 3600 = mood cache
);
```

### New Files to Create

```
src/lib/llm/
  provider.ts           — LLM model config & generateStructured() wrapper
  enrich-movie.ts       — Movie enrichment function + MovieTagsSchema
  extract-preferences.ts — Preference extraction + ExtractedPrefsSchema
  explain-match.ts      — Match explanation generator
  mood-to-filters.ts    — Mood-to-TMDB-filter mapper
  cache.ts              — LLM response cache (wraps llm_cache table)
  index.ts              — Re-exports all functions
```

### Modifications to Existing Files

| File | Change |
|------|--------|
| `src/db/schema.ts` | Add `llmTags`, `llmEnrichedAt` to movies; `preferenceNarrative`, `extractedPrefs`, `prefsExtractedAt` to users; add `llmCache` table |
| `src/app/api/movies/next/route.ts` | After inserting new movie, fire-and-forget `enrichMovie()`. In scoring, add `tag_affinity` dimension comparing `extracted_prefs.moods` vs `llm_tags.vibes` |
| `src/app/matches/page.tsx` | For each match card, show `explainMatch()` output or a "Why?" button that triggers it |
| `src/components/SwipeCard.tsx` | Display LLM-generated tags as chips alongside provider chips (no direct LLM calls) |
| `src/app/onboarding/page.tsx` | **NEW** — Free-text preference input + LLM extraction flow |
| `package.json` | Add deps: `ai`, `@ai-sdk/deepseek` |

### Cost Summary for a 2-Person Couple (DeepSeek V4 Flash)

| Operation | Tokens In | Tokens Out | Cost per Call | Calls/Month | Monthly Cost |
|-----------|-----------|------------|---------------|-------------|-------------|
| Movie enrichment | 200 | 100 | $0.000056 | 200 (new movies) | $0.011 |
| Preference extraction | 500 | 200 | $0.000126 | 2 (once) | $0.0003 |
| Match explanation | 800 | 100 | $0.000140 | 30 | $0.004 |
| Mood-to-filter | 300 | 100 | $0.000070 | 60 | $0.004 |
| **TOTAL** | | | | | **~$0.02/month** |

With cache hits on repeated system prompts, the effective cost is even lower (~$0.01/month).
Even at scale (100 couples, 10,000 movies), monthly costs stay under $2.
DeepSeek V4 Flash is about 1/3 the cost of GPT-4o-mini for output tokens.

### Safety & Guardrails

- **Zod validation on all outputs.** Invalid response → retry once → fall back gracefully (skip tags, skip explanation, use default filters).
- **`temperature: 0` for data extraction.** Movie enrichment and preference extraction are deterministic. Only match explanations use slight creativity (`temperature: 0.3`).
- **LLM never writes to DB directly.** Only the deterministic layer performs mutations. LLM returns data → ranking layer decides → DB writes happen through Drizzle.
- **Graceful degradation without API key.** The app functions fully without `DEEPSEEK_API_KEY`: no tags, no explanations, no mood mapping — but all core features (swipe, match, rank) work normally.
- **Rate limiting.** Cache all enrichment calls. Cache mood-to-filter by input hash (SHA-256). This prevents duplicate LLM calls for the same movie or mood.

### Implementation Priority

| Priority | Function | Impact | Rationale |
|----------|----------|--------|-----------|
| **P0 (Highest)** | Movie enrichment | Biggest | Runs once per movie, enriches the ranking pipeline with semantic tags |
| **P1 (High)** | Preference extraction | High | Enables personalized ranking immediately from natural language |
| **P2 (Medium)** | Match explanation | Delight | Low cost, high perceived value — "wow, it *gets* us" |
| **P3 (Lower)** | Mood-to-filter | Nice UI | Transforms free-text mood into real TMDB filters |
| **Future** | Conversational onboarding | Engagement | More fun than forms, richer data |
| **Future** | Date night curation | Delight | Full experience: movie + mood + snacks |

### Integration with Implementation Roadmap

The LLM layer weaves into existing phases:

**Phase 1 (Foundation):** Add `llm_tags`, `extracted_prefs`, `preferenceNarrative` columns to schema. Build onboarding flow with free-text input + LLM extraction. Create `src/lib/llm/` module with provider config.

**Phase 2 (Smart Ranking):** The ranking function in `src/lib/ranking.ts` reads `llm_tags.vibes` and compares against `extracted_prefs.moods` for a `tag_affinity` score dimension. Movie enrichment runs fire-and-forget after each new movie insert.

**Phase 4 (Engagement Layer):** Match cards on `/matches` page show LLM-generated explanations ("Why this is a great match for you both"). The "Why?" button triggers `explainMatch()` on-demand.

---

## 📊 Interest Tracker

A passive, always-on system that builds each user's taste profile from their swipe behavior and LLM-enriched movie tags. No manual input needed — but the profile is transparent and editable.

### How It Works

Every time a user swipes right or left, the tracker updates counters across multiple dimensions:

```
SWIPE RIGHT → +1 to all matching dimensions
SWIPE LEFT  → -1 to all matching dimensions
SUPER LIKE  → +3 to all matching dimensions
PASS (seen) → neutral (0, but movie is recorded as seen)
```

**Tracked Dimensions** (from LLM-enriched `llm_tags` JSON on movies):

| Dimension | Example Values | Source |
|-----------|---------------|--------|
| **Genres** | sci-fi, romance, thriller, comedy, documentary | TMDB `genre_ids` |
| **Vibes** | cozy, intense, thought-provoking, feel-good, dark | LLM-enriched |
| **Pacing** | slow-burn, fast-paced, steady | LLM-enriched |
| **Emotional Tone** | uplifting, bittersweet, tense, heartwarming, mysterious | LLM-enriched |
| **Era/Decade** | 1970s, 1990s, 2010s, 2020s | Parsed from `release_date` |
| **Runtime Bucket** | under-90min, 90-120min, 120-150min, epic (150+) | Parsed from TMDB |
| **Director** | (specific names) | TMDB credits (future) |
| **Lead Actors** | (specific names) | TMDB credits (future) |
| **Streaming Service** | Netflix, Max, Disney+, etc. | Existing `provider_ids` |

### Normalization & Decay

Raw counts are normalized to a 0.0–1.0 affinity score per dimension:

```
affinity(dimension_value) = sigmoid(right_swipes - left_swipes)
                           --------------------------------
                                     total_swipes_on_dimension
```

Recency weighting: swipes older than 30 days are weighted at 50%. Swipes older than 90 days at 25%. This means if a user used to love horror but hasn't swiped right on one in months, their horror affinity naturally decays.

### Database Schema

```sql
-- New table: interest_signals
CREATE TABLE interest_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  movie_id INTEGER NOT NULL REFERENCES movies(id),
  dimension TEXT NOT NULL,        -- 'genre', 'vibe', 'pacing', 'emotional_tone', 'era', 'runtime'
  dimension_value TEXT NOT NULL,  -- 'sci-fi', 'cozy', 'fast-paced', etc.
  signal INTEGER NOT NULL,        -- +1, -1, or +3
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_interest_signals_user_dim ON interest_signals(user_id, dimension, dimension_value);
CREATE INDEX idx_interest_signals_recency ON interest_signals(user_id, created_at);
```

### Computed View: User Taste Profile

The profile is computed on read (not stored) for freshness:

```typescript
// src/lib/interests/profile.ts
export async function getUserTasteProfile(userId: number): Promise<TasteProfile> {
  const signals = await db.select().from(interestSignals)
    .where(eq(interestSignals.userId, userId));

  // Group by dimension → dimension_value
  const groups = groupByDimension(signals);

  // For each group, compute normalized affinity with recency decay
  const profile: TasteProfile = {};
  for (const [dimension, values] of Object.entries(groups)) {
    profile[dimension] = values.map(([value, signals]) => ({
      value,
      affinity: computeAffinity(signals),
      confidence: Math.min(1, signals.length / 10), // ≥10 signals = high confidence
    })).sort((a, b) => b.affinity - a.affinity);
  }
  return profile;
}
```

### How Interest Tracker Feeds the Ranking Algorithm

The taste profile directly feeds the multi-factor scoring in `src/lib/ranking.ts`:

```typescript
// Genre affinity: how well does this movie's genres match user's taste?
function genreAffinity(movie: Movie, profile: TasteProfile): number {
  const movieGenres = JSON.parse(movie.llm_tags).genres || [];
  let score = 0;
  for (const genre of movieGenres) {
    const aff = profile.genres?.find(g => g.value === genre)?.affinity ?? 0.5;
    score += aff;
  }
  return score / movieGenres.length;
}

// Same pattern for vibes, pacing, emotional tone...
function vibeAffinity(movie: Movie, profile: TasteProfile): number { ... }
function pacingAffinity(movie: Movie, profile: TasteProfile): number { ... }
```

### UI: Taste Profile Page (Future)

`/profile` — Shows each user's taste breakdown visually:
- Genre bars (horizontal, sorted by affinity)
- "Your top vibes: cozy, nostalgic, heartwarming"
- "You've been into: more thrillers lately (trending up ↑)"
- "Your partner's taste overlap: 72% on sci-fi, 35% on romance"
- "Suggested: you haven't tried any musicals — want to explore?"

### Files to Create

```
src/lib/interests/
  profile.ts       — getUserTasteProfile(), computeAffinity(), recency decay
  signals.ts       — recordSwipeSignal(), called from swipe route handler
  index.ts         — re-exports
```

### Files to Modify

- `src/app/api/swipe/route.ts` — After recording swipe, also call `recordSwipeSignal()` to update interest counters
- `src/lib/ranking.ts` — Add `genreAffinity()`, `vibeAffinity()`, etc. that read from `getUserTasteProfile()`
- `src/db/schema.ts` — Add `interestSignals` table definition

---

## 🎭 Mood & Vibe Selector

A lightweight, pre-swipe UI that captures "what are you in the mood for right now?" and applies it as a temporary filter overlay on top of permanent taste preferences.

### The Problem It Solves

Permanent preferences say "I generally like sci-fi." But right now, on this specific evening, the user might want:
- "Something light and funny, I'm exhausted"
- "A tense thriller, I need excitement"
- "Anything but horror tonight"
- "Surprise me, I'm open to anything"

Without mood capture, the algorithm recommends based on stale "what you usually like" and misses the "what you want RIGHT NOW" signal.

### How It Works

Before entering the swipe session, the user sees a compact mood selector:

```
┌─────────────────────────────────────────┐
│  What are you in the mood for?          │
│                                         │
│  🎬  [Thriller] [Comedy] [Romance]      │
│      [Sci-Fi] [Drama] [Horror]          │
│      [Action] [Documentary] [Animation] │
│                                         │
│  🌊  [Cozy] [Intense] [Feel-Good]       │
│      [Dark] [Nostalgic] [Mind-Bending]  │
│                                         │
│  ⏱️  [Under 90 min] [90-120] [Epic]     │
│                                         │
│  🎲  [Surprise Me!]                     │
│                                         │
│  🚫  NOT in the mood for:               │
│      [Horror ✕] [Heavy Drama ✕]         │
│                                         │
│         [Start Swiping →]               │
└─────────────────────────────────────────┘
```

### Mood Acts as a Temporary Filter Overlay

The mood selections are NOT saved to the user's permanent profile. They are session-scoped:

```
FINAL_RANKING = BASE_SCORE (permanent prefs + interest tracker)
              × MOOD_BOOST (1.5x for "in the mood" genres/vibes)
              × MOOD_PENALTY (0.1x for "not in the mood" genres/vibes)
              × PARTNER_MOOD (if partner also in the mood → extra 1.2x multiplier)
```

If both partners are "in the mood for comedy" → comedy movies get a 1.5 × 1.2 = 1.8x boost.

### LLM Mood-to-Filter (Advanced)

The mood selector has a free-text fallback: "Or describe your mood..."

```
User types: "cozy rainy Sunday, nothing too heavy, maybe something nostalgic"
       ↓
LLM (mood-to-filters.ts) extracts:
       ↓
{
  preferredGenres: ['drama', 'romance', 'comedy'],
  preferredVibes: ['cozy', 'nostalgic', 'heartwarming'],
  avoidVibes: ['intense', 'dark', 'violent'],
  maxRuntime: 120,
  yearRange: [1985, 2010]
}
       ↓
Applied as temporary boost/penalty multipliers
```

### Dual Moods: Partner-Aware

When Partner A is "in the mood for action" and Partner B is "not in the mood for violence," the algorithm intelligently finds the overlap:
- Action movies tagged with "light-hearted" or "adventure" (not "violent" or "dark") get boosted
- Pure action/gore gets penalized
- The LLM can generate a bridging suggestion: "How about an adventure-comedy with action elements?"

### Database: No New Tables Needed

Mood selections are ephemeral — stored in the swipe session (cookie, URL param, or server-side session). Not persisted. This keeps the mood selector lightweight and non-committal.

For the free-text LLM path, results can be cached in `llm_cache` with a short TTL (1 hour).

### UI Implementation

- `src/components/MoodSelector.tsx` — Client component with genre/vibe chips + free-text input
- `src/app/swipe/page.tsx` — Renders MoodSelector above SwipeCard (or as a pre-swipe interstitial)
- `src/lib/llm/mood-to-filters.ts` — LLM function for free-text mood parsing (already in LLM section)

The mood selector should be SKIPPABLE — tap "Skip, just show me everything" to bypass and use only permanent preferences.

### Partner Visibility (Optional)

A subtle indicator: "Ashley is in the mood for: 😂 Comedy, 🌊 Cozy" — so you can align without explicitly coordinating. Toggleable in settings.

---

## Summary of All Three Changes

| Change | What It Does | New Files | Modified Files |
|--------|-------------|-----------|----------------|
| DeepSeek V4 Flash | Swaps LLM provider; ~1/3 cost of GPT-4o-mini | None | `src/lib/llm/provider.ts`, BRAINSTORM cost tables |
| Interest Tracker | Builds taste profiles from swipe history | `src/lib/interests/profile.ts`, `signals.ts` | `swipe/route.ts`, `ranking.ts`, `schema.ts` |
| Mood Selector | Pre-swipe vibe/mood filter | `src/components/MoodSelector.tsx` | `swipe/page.tsx`, `ranking.ts` |

All changes are additive — nothing breaks. The app works without DEEPSEEK_API_KEY set (graceful degradation).

---

## Algorithm Catalog

### 1. Bayesian Average (IMDB-Style Rating Correction)

**Problem:** A movie with 1 review at 10/10 should not outrank a movie with 500 reviews at 9/10.

**Formula:**
```
bayesian_rating = (R × v + C × m) / (v + m)
```

Where:
- `R` = movie's average rating (from TMDB `vote_average`)
- `v` = number of votes (from TMDB `vote_count`)
- `C` = global average rating across all movies (~6.5 on TMDB)
- `m` = minimum votes for full weight (e.g., 50)

**Implementation:** One function in `src/lib/ranking.ts`. Uses existing TMDB data we already fetch but don't store.

### 2. Elo Rating System

**Problem:** How do we rank movies based on swipe behavior without explicit star ratings?

**Formulas:**
```
Expected score:  E(A) = 1 / (1 + 10^((R_B - R_A) / 400))
Rating update:   R_new = R_old + K × (S - E)
```

Where:
- `K` = k-factor (32 = standard, higher = more responsive to recent swipes)
- `S` = actual outcome (1 = right swipe / win, 0 = left swipe / loss)
- `R_A`, `R_B` = current Elo ratings of the two movies being compared

**Couples application:** Every right-swipe is a "win" for that movie. Every left-swipe is a "loss." Movies develop Elo scores over time. If both partners have high-Elo movies in common, those become priority suggestions.

**Schema change needed:** Add `elo_rating` column to `movies` table. Or compute on-the-fly from swipe history (slower but no migration).

### 3. Borda Count (Ranked Voting)

**Problem:** How do we aggregate preferences when users rank (not just binary swipe) their top choices?

**Standard Borda:** For n candidates, rank i gets `n - i` points. Score = sum across all voters.

**Exponential Borda (EBC):** `p_i = 2^(n - i)` — doubles points for each rank. Makes top preference much more important.

**Quadratic Borda (QBC):** `p_i = 1 + (n-i)(n-i+1)/2` — smoothly increasing gap between ranks.

**Why Borda for couples:** Strong mathematical properties — always ranks Condorcet winner over Condorcet loser, least manipulable positional rule, best at finding acceptable compromises. Perfect for "rank your top 5 genres tonight."

### 4. Multi-Factor Weighted Scoring

**Problem:** A single signal (popularity) is insufficient. We need to combine popularity, genre affinity, partner prediction, recency, and diversity.

**Formula:**
```
final_score = w_pop × normalize(popularity)
            + w_rating × bayesian_rating(vote_avg, vote_count)
            + w_genre × genre_affinity(user, movie_genres)
            + w_partner × partner_likelihood(user, partner, movie)
            + w_recency × recency_decay(last_shown_at)
            + w_diversity × diversity_bonus(recent_genres)
```

**Default weights (starting point):**
| Signal | Weight | Rationale |
|--------|--------|-----------|
| Popularity | 0.15 | Baseline quality signal from TMDB |
| Bayesian Rating | 0.20 | Corrected for small-sample distortion |
| Genre Affinity | 0.25 | Most predictive of individual enjoyment |
| Partner Likelihood | 0.20 | Most predictive of a mutual match |
| Recency Decay | 0.10 | Avoid showing same movies repeatedly |
| Diversity Bonus | 0.10 | Prevent genre tunnel vision |

**Cold start fallback:** When `total_swipes < 20`:
```
score = 0.70 × normalize(popularity) + 0.30 × bayesian_rating
```
Smooth transition: `personalization_weight = min(1, total_swipes / 20)`

### 5. Collaborative Filtering (Cosine Similarity)

**Problem:** How do we recommend movies when we have multiple couples?

**User-User Cosine Similarity:**
```
cosine(u, v) = (u · v) / (||u|| × ||v||)
```

Mean-center ratings first for best results (adjusted cosine / Pearson correlation).

**Weighted Prediction:**
```
predicted(u, i) = mean(u) + Σ_v[ sim(u,v) × (rating(v,i) - mean(v)) ] / Σ_v[ |sim(u,v)| ]
```

**Couples application:** Find couples with similar taste patterns. "Couples like you both enjoyed Inception and Interstellar." Their other matches become recommendations for you.

### 6. Exponential Temporal Decay (Recency Weighting)

**Problem:** User preferences change over time. A genre they loved 6 months ago may not reflect current taste.

**Formula:**
```
weight(t) = e^(-λ × Δt)
half_life = ln(2) / λ
```

With `λ = 0.05` → half-life ≈ 14 days. A right-swipe from 2 weeks ago counts half as much as one from today.

**Implementation:** Track `swiped_at` timestamp (already in schema). Apply decay when computing genre affinity from swipe history.

### 7. Partner Prediction Model

**Problem:** Can we predict whether the other person will like a movie *before* they swipe?

**Simple approach (genre-based):**
```
P(partner_likes | movie) = Σ_g [ genre_prob(partner, g) × has_genre(movie, g) ] / Σ_g has_genre(movie, g)
```

Where `genre_prob(partner, g)` = fraction of partner's right-swipes that have genre `g`.

**Display on card:** "85% chance Ashley will ❤️ this!" — computed from partner's genre distribution applied to the movie's genres.

### 8. Diversity Enforcement (Sliding Window)

**Problem:** Without constraints, the algorithm can get stuck showing 10 action movies in a row.

**Rule:** Max 3 movies of the same genre in the last 10 suggestions.

**Implementation:** Track a sliding window of `last_shown_genres[]`. When scoring, apply a penalty:
```
diversity_penalty(movie) = count(recent_genres ∩ movie_genres) > threshold ? -0.3 : 0
```

---

## Feature Brainstorm

### Category A: Personalization (Schema Changes Required)

#### A1. Genre Preference Profiles
**Impact:** HIGH — enables all downstream ranking
**Effort:** MEDIUM — schema migration + onboarding UI + ranking integration

Add `genre_prefs` JSON column to `users` table. Onboarding flow at `/onboarding`: swipe through 20 genre cards (like/don't like). Alternatively, auto-build from swipe history (implicit preferences).

**Schema change** (`src/db/schema.ts`):
```ts
genrePrefs: text("genre_prefs"), // JSON: { "28": 0.8, "35": 0.2, ... }
```

**TMDB genre IDs to support:**
| ID | Genre | ID | Genre |
|----|-------|----|-------|
| 28 | Action | 10749 | Romance |
| 12 | Adventure | 878 | Sci-Fi |
| 16 | Animation | 53 | Thriller |
| 35 | Comedy | 10752 | War |
| 80 | Crime | 37 | Western |
| 99 | Documentary | 27 | Horror |
| 18 | Drama | 10402 | Music |
| 10751 | Family | 9648 | Mystery |
| 14 | Fantasy | 10770 | TV Movie |

#### A2. Streaming Provider Preferences
**Impact:** HIGH — practical utility, reduces frustration
**Effort:** LOW — UI only, provider data already fetched

Let users select which services they subscribe to. Only show movies available on the intersection. The `provider_ids` column already exists on `movies`. Need UI to set preferences and filter in `/api/movies/next`.

#### A3. Era / Year Preferences
**Impact:** MEDIUM — niche but important for some couples
**Effort:** LOW — TMDB supports `primary_release_date.gte/lte` natively

"Only show movies from 1990-2024" / "Classics only (pre-1980)" / "New releases only (last 2 years)."

#### A4. Mood-Based Filtering
**Impact:** HIGH — emotional resonance, date-night use case
**Effort:** LOW — map moods to TMDB genre IDs

| Mood | Genres |
|------|--------|
| "Feeling lazy" | Comedy (35), Animation (16) |
| "Date night" | Romance (10749), Drama (18) |
| "Adventure" | Action (28), Adventure (12), Sci-Fi (878) |
| "Thought-provoking" | Drama (18), Documentary (99), Mystery (9648) |
| "Scared" | Horror (27), Thriller (53) |

### Category B: Selection Options (UI & Swipe Enum Changes)

#### B1. Three-Tier Swipe: Love / Like / Pass
**Impact:** HIGH — richer signal for ranking
**Effort:** MEDIUM — schema enum migration + UI update

Extend `direction` enum from `["left", "right"]` to `["love", "like", "pass"]`.
- `love` = 2× weight in genre affinity, Elo, and ranking
- `like` = 1× weight
- `pass` = exclude from future suggestions

**Schema change** (`src/db/schema.ts:32`):
```ts
direction: text("direction", { enum: ["love", "like", "pass"] }).notNull(),
```

**File to modify:** `src/app/api/swipe/route.ts:25` — update validation.

#### B2. "Seen It" Button
**Impact:** MEDIUM — prevents penalizing movies you've already watched
**Effort:** LOW — add `seen` to enum, separate table or flag

Fourth option: skip but don't penalize. Movies marked "seen" never appear again for that user but aren't counted as a negative signal in Elo or genre affinity.

#### B3. Undo Swipe
**Impact:** MEDIUM — reduces swipe anxiety
**Effort:** LOW — store last 3 swipes in session, allow pop+delete

Simple: keep a `recent_swipes` array in memory/localStorage. Undo = DELETE from `swipes` table + re-add to available pool.

#### B4. Batch / Rapid Swipe Mode
**Impact:** MEDIUM — faster initial taste calibration
**Effort:** MEDIUM — new UI component, grid of 6-12 poster cards

Show a grid of posters. Tap to love/like/pass. Much faster than one-at-a-time for the first 20-30 swipes (cold start calibration).

### Category C: Smart Ranking & Optimization

#### C1. Weighted Multi-Factor Ranking (Replace `available[0]`)
**Impact:** CRITICAL — the single highest-impact change
**Effort:** MEDIUM — new `src/lib/ranking.ts` + wire into `/api/movies/next`

**Current code** (`src/app/api/movies/next/route.ts:82-83`):
```ts
const available = allMovies.filter((m) => !swipedMovieIds.has(m.id));
if (available.length > 0) {
  const movie = available[0];  // ← THIS IS THE PROBLEM
```

**Replace with:**
```ts
const scored = available.map(m => scoreMovie(m, userId, partnerId, swipeHistory));
scored.sort((a, b) => b.score - a.score);
const movie = scored[0];
```

Create `src/lib/ranking.ts` with pure, testable functions:
- `bayesianRating(voteAvg, voteCount, globalAvg, minVotes)`
- `genreAffinity(genrePrefs, movieGenreIds)`
- `partnerLikelihood(partnerSwipeHistory, movieGenreIds)`
- `recencyDecay(lastShownAt, lambda)`
- `diversityPenalty(movieGenreIds, recentGenreWindow)`
- `scoreMovie(movie, userId, partnerId, context)` — combines all above

#### C2. Partner Prediction ("They'll Probably Like This")
**Impact:** HIGH — social proof increases engagement
**Effort:** LOW — compute from existing swipe data

Based on partner's swipe history genre distribution, predict probability they'll right-swipe. Display on card: "85% chance Ashley will ❤️ this!"

**File to modify:** `src/app/api/movies/next/route.ts` — add `partnerLikeProbability` to response.

#### C3. Least-Recently-Considered (Recency Decay)
**Impact:** MEDIUM — ensures full pool exploration
**Effort:** LOW — track `last_shown_at` per user-movie

Add `lastShownAt` to track when a movie was last suggested to a user. Apply exponential decay: `weight = e^(-0.05 × days_since_shown)`.

#### C4. Cold Start Handling
**Impact:** MEDIUM — new couples need good suggestions from day 1
**Effort:** LOW — weight adjustment based on swipe count

For couples with < 20 total swipes: lean on TMDB popularity + Bayesian rating. After 20: switch to personalized ranking. Smooth transition: `w_personal = min(1, total_swipes / 20)`.

### Category D: Gamification & Engagement

#### D1. Match Streaks
**Impact:** MEDIUM — habit formation
**Effort:** LOW — compute from match timestamps

"You've matched 5 days in a row! 🔥" Display on `/matches` page. Compute from `swipes.createdAt` — consecutive days with at least one match.

#### D2. Match Quality Score
**Impact:** MEDIUM — differentiates "meh match" from "great match"
**Effort:** LOW — compute at match time

Not just "matched" — how good? Score 1-100 based on: both super-liked vs. both merely liked, genre overlap with both profiles, both have high affinity.

#### D3. Daily Curated Pick
**Impact:** MEDIUM — creates daily habit
**Effort:** LOW — cron job or on-demand computation

One algorithm-highlighted movie per day. "Tonight's Pick: Inception — 92% match for you both." Display on home page (`src/app/page.tsx`).

#### D4. "Surprise Me" Mode
**Impact:** LOW — fun but not essential
**Effort:** LOW — random from intersection

Random movie from the intersection of both users' unwatched, mutually-liked pool. No swiping, just a suggested movie.

### Category E: Watch Tracking & History

#### E1. "We Watched It"
**Impact:** HIGH — closes the feedback loop
**Effort:** MEDIUM — new table or status on matches

Mark matched movies as watched. Rate 1-5 stars. Feeds back into personalization. "Don't suggest movies we've already seen together."

**Schema addition:**
```ts
export const watchHistory = sqliteTable("watch_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  movieId: integer("movie_id").notNull().references(() => movies.id),
  userId1: integer("user_id1").notNull(),
  userId2: integer("user_id2").notNull(),
  rating1: integer("rating1"),
  rating2: integer("rating2"),
  watchedAt: integer("watched_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

#### E2. Watch Queue / Watchlist
**Impact:** MEDIUM — planning ahead
**Effort:** LOW — simple many-to-many table

Save matches to a queue. Plan the next 5 date nights. Reorder by priority.

### Category F: Discovery & Serendipity

#### F1. "Hidden Gem" Mode
**Impact:** LOW — niche but delightful
**Effort:** LOW — TMDB filter

Only show movies with < 5000 votes on TMDB but > 7.0 rating. Surface obscure quality films.

#### F2. "Because You Liked..."
**Impact:** MEDIUM — builds on existing matches
**Effort:** MEDIUM — item-based CF on genre overlap

If both users swiped right on Inception → suggest Tenet, Interstellar, Memento. Item-based collaborative filtering on genre + keyword overlap.

#### F3. Seasonal / Themed Suggestions
**Impact:** LOW — nice-to-have
**Effort:** LOW — month-to-genre mapping

October = horror. December = Christmas/feel-good. February = romance. Auto-curated by release month or genre.

### Category G: Multi-Person & Social

#### G1. Group Mode (3+ People)
**Impact:** HIGH — expands use case beyond couples
**Effort:** HIGH — room system, multi-user swiping, Borda consensus

Create a room. Link up to N people. Everyone swipes. Matches = movies everyone liked. Uses Borda count for consensus ranking when exact matches are rare.

#### G2. Share Match
**Impact:** LOW — viral growth
**Effort:** LOW — generate shareable image/card

"We're watching [movie] tonight!" → share card to social/chat. Generates invite link to the app.

---

## Recommended Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
*Enables everything else. Do this first.*

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1 | Add `genre_ids` and `popularity` to `movies` table | `src/db/schema.ts` | 30 min |
| 2 | Persist `genre_ids` and `popularity` from TMDB in `/api/movies/next` | `src/app/api/movies/next/route.ts:44-55` | 1 hr |
| 3 | Add `genre_prefs` JSON column to `users` | `src/db/schema.ts:4-11` | 30 min |
| 4 | Build onboarding flow at `/onboarding` — genre selection | New: `src/app/onboarding/page.tsx` | 3 hr |
| 5 | Create `src/lib/ranking.ts` with scoring function | New file | 4 hr |

**Phase 1 deliverable:** Users can set genre preferences, movies have genre data in DB, and a pure ranking function exists (not yet wired in).

### Phase 2: Smart Ranking (Week 2-3)
*The single highest-impact change.*

| # | Task | Files | Effort |
|---|------|-------|--------|
| 6 | Wire scoring into `/api/movies/next` | `src/app/api/movies/next/route.ts:82-83` | 2 hr |
| 7 | Implement Bayesian rating from TMDB `vote_average`/`vote_count` | `src/lib/ranking.ts` | 1 hr |
| 8 | Add genre affinity scoring from user prefs + swipe history | `src/lib/ranking.ts` | 2 hr |
| 9 | Add recency decay for previously-shown movies | `src/lib/ranking.ts` + schema | 2 hr |
| 10 | Add diversity enforcement (max 3 per genre in window of 10) | `src/lib/ranking.ts` | 1 hr |

**Phase 2 deliverable:** Movie suggestions are ranked, not random. The top suggestion is the best predicted mutual match.

### Phase 3: Enhanced Selection (Week 3-4)
*Richer signals, better UX.*

| # | Task | Files | Effort |
|---|------|-------|--------|
| 11 | Extend swipe enum to `love | like | pass` | `src/db/schema.ts:32`, `src/app/api/swipe/route.ts:25` | 2 hr |
| 12 | Update swipe UI for three-tier cards | `src/app/swipe/page.tsx` | 3 hr |
| 13 | Add Undo button (last 3 swipes) | `src/app/swipe/page.tsx` + API | 2 hr |
| 14 | Add partner prediction indicator on cards | `src/app/api/movies/next/route.ts` response | 2 hr |
| 15 | Add batch/rapid swipe mode | New: `src/app/swipe/batch/page.tsx` | 4 hr |

**Phase 3 deliverable:** Users can express nuanced preferences, undo mistakes, and see partner prediction on cards.

### Phase 4: Engagement Layer (Week 4-5)
*Keep couples coming back.*

| # | Task | Files | Effort |
|---|------|-------|--------|
| 16 | Match quality scoring (1-100) | `src/app/api/swipe/route.ts:65-66` | 1 hr |
| 17 | "We Watched It" + 1-5 star rating | New: `src/db/schema.ts` table + UI | 4 hr |
| 18 | Daily curated pick on home page | `src/app/page.tsx` | 2 hr |
| 19 | Match streaks display | `src/app/matches/page.tsx` | 2 hr |

**Phase 4 deliverable:** Gamification layer, watch tracking, and daily engagement hooks.

### Phase 5: Discovery & Polish (Week 5-6)
*Delight and serendipity.*

| # | Task | Files | Effort |
|---|------|-------|--------|
| 20 | "Because You Liked..." recommendations | `src/lib/ranking.ts` | 3 hr |
| 21 | Hidden Gem mode | `src/lib/tmdb.ts` + UI toggle | 2 hr |
| 22 | Seasonal/themed suggestions | `src/lib/ranking.ts` | 1 hr |
| 23 | Streaming provider preferences UI | New settings page | 2 hr |
| 24 | Watch queue / watchlist | New table + UI | 3 hr |

---

## Quick Wins (Can Be Done in < 1 Hour Each)

These require minimal code changes but deliver noticeable improvement:

1. **Store `genre_ids` in DB** — Already fetched from TMDB, just not persisted. One-line change in `src/app/api/movies/next/route.ts:44-55`.
2. **Sort by TMDB popularity** — Instead of `available[0]`, sort by `popularity` descending before picking. One-line change.
3. **Filter out movies partner already passed on** — If Ashley swiped left on a movie, don't show it to Jacob. Saves frustration. Modify the filter in `/api/movies/next`.
4. **Add `vote_count` to movie response** — Already in TMDB data, just not passed through. Useful for UI display.
5. **Show "Other person also liked this" badge** — The `otherLiked` boolean already exists in the API response. Just needs UI rendering on the swipe card.

---

## Schema Migration Summary

All changes needed to the database (`src/db/schema.ts`):

```ts
// movies table — add these columns:
genreIds: text("genre_ids"),        // JSON: [28, 12, 878]
popularity: real("popularity"),     // TMDB popularity score

// users table — add these columns:
genrePrefs: text("genre_prefs"),           // JSON: { "28": 0.8, "35": 0.2 }
providerPrefs: text("provider_prefs"),     // JSON: [8, 337, 15]
yearRangeMin: integer("year_range_min"),   // e.g., 1990
yearRangeMax: integer("year_range_max"),   // e.g., 2024

// swipes table — modify enum:
direction: text("direction", { enum: ["love", "like", "pass"] }).notNull(),

// new tables:
export const watchHistory = sqliteTable("watch_history", { ... });
export const watchQueue = sqliteTable("watch_queue", { ... });
```

---

## File Change Summary

| File | Change |
|------|--------|
| `src/db/schema.ts` | Add columns to movies/users, modify swipe enum, add new tables |
| `src/app/api/movies/next/route.ts` | Persist genre_ids/popularity, replace `available[0]` with ranked scoring, add partner prediction |
| `src/app/api/swipe/route.ts` | Update enum validation, add match quality scoring |
| `src/lib/tmdb.ts` | Already has `genre_ids` and `popularity` — just need to pass through |
| `src/lib/ranking.ts` | **NEW** — pure scoring functions |
| `src/app/onboarding/page.tsx` | **NEW** — genre/provider preference selection |
| `src/app/swipe/page.tsx` | Three-tier swipe UI, undo, partner prediction display |
| `src/app/page.tsx` | Daily curated pick display |
| `src/app/matches/page.tsx` | Match quality scores, streaks, watched status |

---

## Appendix: TMDB Genre ID Reference

```
28  = Action        12  = Adventure     16  = Animation
35  = Comedy        80  = Crime         99  = Documentary
18  = Drama         10751 = Family      14  = Fantasy
36  = History       27  = Horror        10402 = Music
9648 = Mystery      10749 = Romance     878  = Sci-Fi
10770 = TV Movie    53  = Thriller      10752 = War
37  = Western
```

---

## Appendix: Competitor URLs

- Hangrily: hangrily.com
- Swypo: swypo.app
- 2watch: 2watch.app
- Matched (Taste.io): taste.io
- TasteRay: tastaray.com
- Dinelist: dinelist.com
- Plick: plick.app
- Giddy: giddy.couple
- CoupleCards: GitHub (66 stars, MIT)

---

*This document is a living brainstorm. Update it as features are built and new ideas emerge.*

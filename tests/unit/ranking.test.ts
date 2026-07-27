import {
  bayesianRating,
  genreAffinity,
  vibeAffinity,
  partnerLikelihood,
  recencyScore,
  diversityScore,
  coldStartScore,
  TMDB_GENRE_MAP,
} from '@/lib/ranking';
import type { MovieCandidate, TasteProfile } from '@/lib/ranking';

// ── Test fixtures ────────────────────────────────────────────────────────────

const createMovie = (overrides: Partial<MovieCandidate> = {}): MovieCandidate => ({
  id: 1,
  tmdbId: 12345,
  title: 'Test Movie',
  overview: 'A test movie overview',
  voteAverage: 7.5,
  voteCount: 500,
  popularity: 150,
  genreIds: [28, 35], // Action, Comedy
  llmTags: {
    vibes: ['fun', 'exciting'],
    emotionalTone: ['joyful'],
    themes: ['friendship'],
    pacing: 'fast',
  },
  providerIds: [8, 337],
  releaseDate: '2024-01-15',
  createdAt: Date.now(),
  ...overrides,
});

const createProfile = (overrides: Partial<TasteProfile> = {}): TasteProfile => ({
  genres: {
    Action: { affinity: 0.9, confidence: 0.8 },
    Comedy: { affinity: 0.7, confidence: 0.6 },
  },
  vibes: {
    fun: { affinity: 0.8, confidence: 0.7 },
    exciting: { affinity: 0.6, confidence: 0.5 },
  },
  emotionalTones: {
    joyful: { affinity: 0.85, confidence: 0.75 },
  },
  totalSignals: 10,
  ...overrides,
});

// ── bayesianRating ───────────────────────────────────────────────────────────

describe('bayesianRating', () => {
  it('returns 0.5 for null rating', () => {
    expect(bayesianRating(null, 100)).toBe(0.5);
  });

  it('returns 0.5 for null votes', () => {
    expect(bayesianRating(7.0, null)).toBe(0.5);
  });

  it('returns normalized score for valid input', () => {
    const result = bayesianRating(8.0, 1000);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('clamps results between 0 and 1', () => {
    expect(bayesianRating(1.0, 10)).toBeGreaterThanOrEqual(0);
    expect(bayesianRating(10.0, 10000)).toBeLessThanOrEqual(1);
  });
});

// ── genreAffinity ────────────────────────────────────────────────────────────

describe('genreAffinity', () => {
  it('returns 0.5 when no profile', () => {
    expect(genreAffinity(createMovie(), null)).toBe(0.5);
  });

  it('returns 0.5 when profile has no genres', () => {
    expect(genreAffinity(createMovie(), createProfile({ genres: {} }))).toBe(0.5);
  });

  it('returns 0.3 when movie has no matching genres', () => {
    const movie = createMovie({ genreIds: [99] }); // Documentary
    const profile = createProfile({
      genres: { Romance: { affinity: 0.9, confidence: 0.8 } },
    });
    expect(genreAffinity(movie, profile)).toBe(0.3);
  });

  it('returns weighted affinity for matching genres', () => {
    const movie = createMovie({ genreIds: [28, 35] });
    const profile = createProfile();
    const result = genreAffinity(movie, profile);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('returns 0.3 when movie has no genre IDs', () => {
    const movie = createMovie({ genreIds: [] });
    const profile = createProfile();
    expect(genreAffinity(movie, profile)).toBe(0.3);
  });
});

// ── vibeAffinity ─────────────────────────────────────────────────────────────

describe('vibeAffinity', () => {
  it('returns 0.5 when no profile', () => {
    expect(vibeAffinity(createMovie(), null)).toBe(0.5);
  });

  it('returns 0.5 when movie has no llmTags', () => {
    const movie = createMovie({ llmTags: null });
    const profile = createProfile();
    expect(vibeAffinity(movie, profile)).toBe(0.5);
  });

  it('returns 0.5 when llmTags has no vibes or emotionalTone', () => {
    const movie = createMovie({ llmTags: { themes: ['friendship'] } });
    const profile = createProfile();
    expect(vibeAffinity(movie, profile)).toBe(0.5);
  });

  it('returns weighted affinity for matching vibes', () => {
    const movie = createMovie();
    const profile = createProfile();
    const result = vibeAffinity(movie, profile);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ── partnerLikelihood ────────────────────────────────────────────────────────

describe('partnerLikelihood', () => {
  it('returns 1.0 if partner already right-swiped', () => {
    const movie = createMovie();
    const result = partnerLikelihood(movie, null, new Set(), new Set([1]));
    expect(result).toBe(1.0);
  });

  it('returns 0.0 if partner already swiped (not right)', () => {
    const movie = createMovie();
    const result = partnerLikelihood(movie, null, new Set([1]), new Set());
    expect(result).toBe(0.0);
  });

  it('returns 0.5 when no partner profile', () => {
    const movie = createMovie({ id: 999 });
    const result = partnerLikelihood(movie, null, new Set(), new Set());
    expect(result).toBe(0.5);
  });

  it('returns weighted score with partner profile', () => {
    const movie = createMovie({ id: 999 });
    const profile = createProfile();
    const result = partnerLikelihood(movie, profile, new Set(), new Set());
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ── recencyScore ─────────────────────────────────────────────────────────────

describe('recencyScore', () => {
  it('returns 1.0 if movie not in recently shown', () => {
    expect(recencyScore(1, [2, 3, 4])).toBe(1.0);
  });

  it('returns 1.0 if movie is at position 10 or beyond', () => {
    const ids = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(recencyScore(11, ids)).toBe(1.0);
  });

  it('returns lower score for recently shown movies', () => {
    expect(recencyScore(1, [1, 2, 3])).toBeLessThan(1.0);
  });

  it('returns higher score for position 1 vs position 5', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const score1 = recencyScore(1, ids);
    const score5 = recencyScore(5, ids);
    expect(score1).toBeGreaterThan(score5);
  });
});

// ── diversityScore ───────────────────────────────────────────────────────────

describe('diversityScore', () => {
  it('returns 0.8 when movie has no genres', () => {
    const movie = createMovie({ genreIds: [] });
    expect(diversityScore(movie, ['Action'])).toBe(0.8);
  });

  it('returns 1.0 when no genre overlap', () => {
    const movie = createMovie({ genreIds: [18] }); // Drama
    expect(diversityScore(movie, ['Action', 'Comedy'])).toBe(1.0);
  });

  it('returns 0.5 when overlap > 2', () => {
    const movie = createMovie({ genreIds: [28, 35, 18] });
    expect(diversityScore(movie, ['Action', 'Comedy', 'Drama'])).toBe(0.5);
  });

  it('returns reduced score for single genre overlap', () => {
    const movie = createMovie({ genreIds: [28, 18] });
    const result = diversityScore(movie, ['Action']);
    expect(result).toBeCloseTo(0.85, 2);
  });
});

// ── coldStartScore ───────────────────────────────────────────────────────────

describe('coldStartScore', () => {
  it('returns a value between 0 and 1', () => {
    const result = coldStartScore(createMovie());
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('handles null popularity and votes', () => {
    const movie = createMovie({ popularity: null, voteAverage: null, voteCount: null });
    const result = coldStartScore(movie);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('favors popular highly-rated movies', () => {
    const goodMovie = createMovie({ popularity: 900, voteAverage: 9.0, voteCount: 10000 });
    const badMovie = createMovie({ popularity: 10, voteAverage: 2.0, voteCount: 5 });
    expect(coldStartScore(goodMovie)).toBeGreaterThan(coldStartScore(badMovie));
  });
});

// ── TMDB_GENRE_MAP ───────────────────────────────────────────────────────────

describe('TMDB_GENRE_MAP', () => {
  it('has all standard TMDB genres', () => {
    expect(TMDB_GENRE_MAP[28]).toBe('Action');
    expect(TMDB_GENRE_MAP[35]).toBe('Comedy');
    expect(TMDB_GENRE_MAP[10749]).toBe('Romance');
    expect(TMDB_GENRE_MAP[878]).toBe('Science Fiction');
  });

  it('has 19 genres', () => {
    expect(Object.keys(TMDB_GENRE_MAP).length).toBe(19);
  });
});

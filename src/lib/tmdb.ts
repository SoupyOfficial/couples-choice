const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const STREAMING_PROVIDERS: Record<number, string> = {
  8: "Netflix",
  9: "Amazon Prime",
  337: "Disney+",
  384: "Max",
  15: "Hulu",
  350: "Apple TV+",
  386: "Peacock",
  531: "Paramount+",
};

// ── TMDB raw response types ──────────────────────────────────────────────────

export interface TMDBMovieResult {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  popularity: number;
}

export interface TMDBDiscoverResponse {
  page: number;
  results: TMDBMovieResult[];
  total_pages: number;
  total_results: number;
}

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: Record<
    string,
    {
      link: string;
      flatrate?: TMDBWatchProvider[];
      rent?: TMDBWatchProvider[];
      buy?: TMDBWatchProvider[];
      free?: TMDBWatchProvider[];
      ads?: TMDBWatchProvider[];
    }
  >;
}

// ── Our cleaned movie type (matches DB schema) ───────────────────────────────

export interface MovieResult {
  id: number;
  tmdbId: number;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  voteAverage: number;
  popularity: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error(
      "TMDB_API_KEY environment variable is not set. Add it to your .env file.",
    );
  }
  return key;
}

async function tmdbFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${path}`);

  url.searchParams.set("api_key", apiKey);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `TMDB API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

// ── Image URL helper ─────────────────────────────────────────────────────────

export function getImageUrl(path: string | null, size: string): string | null {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

// ── Movie discovery ──────────────────────────────────────────────────────────

function toMovieResult(raw: TMDBMovieResult): MovieResult {
  return {
    id: raw.id,
    tmdbId: raw.id,
    title: raw.title,
    overview: raw.overview,
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    releaseDate: raw.release_date,
    voteAverage: raw.vote_average,
    popularity: raw.popularity,
  };
}

export async function getDiscoverMovies(
  page = 1,
): Promise<{ results: MovieResult[]; totalPages: number }> {
  const response = await tmdbFetch<TMDBDiscoverResponse>("/discover/movie", {
    watch_region: "US",
    with_watch_providers: "8|9|337|384|15|350|386|531",
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    "vote_count.gte": "200",
    include_adult: "false",
    language: "en-US",
    page,
  });

  return {
    results: response.results.map(toMovieResult),
    totalPages: response.total_pages,
  };
}

export async function getWatchProviders(tmdbId: number): Promise<number[]> {
  try {
    const response = await tmdbFetch<TMDBWatchProvidersResponse>(
      `/movie/${tmdbId}/watch/providers`,
      { watch_region: "US" },
    );

    const usProviders = response.results?.US?.flatrate;
    if (!usProviders) return [];

    const allowedIds = new Set(Object.keys(STREAMING_PROVIDERS).map(Number));
    return usProviders
      .map((p) => p.provider_id)
      .filter((id) => allowedIds.has(id));
  } catch {
    return [];
  }
}

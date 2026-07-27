import { db } from '../../db/index';
import { llmCache, movies } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateObject } from 'ai';
import { z } from 'zod';
import { LLM_MODEL } from './provider';
import { getCachedResponse, setCachedResponse } from './cache';

export const MovieTagsSchema = z.object({
  vibes: z.array(z.string()).max(6).describe('Atmospheric/experiential tags: cozy, intense, mind-bending, nostalgic, etc.'),
  pace: z.enum(['slow-burn', 'steady', 'fast-paced']).describe('Narrative pacing'),
  emotionalTone: z.array(z.string()).max(4).describe('Emotional impact: uplifting, bittersweet, tense, heartwarming, etc.'),
  dateNightScore: z.number().min(0).max(10).describe('How suitable for a couple date night (0=terrible, 10=perfect)'),
  contentWarnings: z.array(z.string()).max(3).describe('Content notes: violence, language, sexual content, etc.'),
  similarTo: z.array(z.string()).max(4).describe('Well-known movies this is similar to in tone or theme'),
});

export type MovieTags = z.infer<typeof MovieTagsSchema>;

export async function enrichMovie(movieId: number): Promise<MovieTags | null> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY not set — skipping enrichMovie');
    return null;
  }

  const cacheKey = `enrich-movie:${movieId}`;
  const cached = await getCachedResponse(cacheKey);
  if (cached) {
    return JSON.parse(cached) as MovieTags;
  }

  const [movie] = await db
    .select({
      title: movies.title,
      overview: movies.overview,
      releaseDate: movies.releaseDate,
      voteAverage: movies.voteAverage,
      genreIds: movies.genreIds,
    })
    .from(movies)
    .where(eq(movies.id, movieId));

  if (!movie) {
    throw new Error(`Movie with id ${movieId} not found`);
  }

  const prompt = `Analyze this movie and generate descriptive tags for matching couples.

Title: ${movie.title}
Overview: ${movie.overview || 'N/A'}
Release Date: ${movie.releaseDate || 'N/A'}
Rating: ${movie.voteAverage ?? 'N/A'}/10
Genre IDs: ${movie.genreIds || 'N/A'}

Return structured tags describing the movie's atmosphere, pacing, emotional tone, suitability for date night, content warnings, and similar well-known movies.`;

  const result = await generateObject({
    model: LLM_MODEL,
    schema: MovieTagsSchema,
    prompt,
    temperature: 0,
  });

  const tags = result.object;

  await setCachedResponse(cacheKey, tags);

  await db
    .update(movies)
    .set({
      llmTags: JSON.stringify(tags),
      llmEnrichedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(movies.id, movieId));

  return tags;
}

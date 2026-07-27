import { generateObject } from 'ai';
import { z } from 'zod';
import { LLM_MODEL } from './provider';
import { getCachedResponse, setCachedResponse } from './cache';

export const MoodFiltersSchema = z.object({
  preferredGenres: z.array(z.string()).max(5),
  preferredVibes: z.array(z.string()).max(5),
  avoidVibes: z.array(z.string()).max(5),
  maxRuntime: z.number().nullable().describe('Max runtime in minutes, null = no limit'),
  yearGte: z.number().nullable(),
  yearLte: z.number().nullable(),
});

export type MoodFilters = z.infer<typeof MoodFiltersSchema>;

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function moodToFilters(moodText: string): Promise<MoodFilters | null> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY not set — skipping moodToFilters');
    return null;
  }

  const normalized = moodText.trim().toLowerCase();
  const cacheKey = `mood-to-filters:${simpleHash(normalized)}`;

  const cached = await getCachedResponse(cacheKey);
  if (cached) {
    return JSON.parse(cached) as MoodFilters;
  }

  const prompt = `Convert this free-text mood description into structured TMDB-compatible filters for movie recommendations:

"${moodText}"

Map the mood to preferred genres, vibes to seek, vibes to avoid, max runtime preference, and year range.`;

  const result = await generateObject({
    model: LLM_MODEL,
    schema: MoodFiltersSchema,
    prompt,
    temperature: 0,
  });

  const filters = result.object;

  await setCachedResponse(cacheKey, filters, 3600);

  return filters;
}

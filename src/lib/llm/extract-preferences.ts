import { db } from '../../db/index';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateObject } from 'ai';
import { z } from 'zod';
import { LLM_MODEL } from './provider';

export const ExtractedPrefsSchema = z.object({
  genres: z.array(z.string()).max(8).describe('Preferred genres'),
  yearRange: z.tuple([z.number(), z.number()]).describe('[minYear, maxYear] preference'),
  moods: z.array(z.string()).max(6).describe('Preferred vibes/moods'),
  avoidThemes: z.array(z.string()).max(6).describe('Themes or content to avoid'),
  runtimePref: z.enum(['under-90', '90-120', '120-150', 'epic', 'any']),
  languages: z.array(z.string()).max(5).describe('Preferred languages (e.g., ["en", "ko"])'),
});

export type ExtractedPrefs = z.infer<typeof ExtractedPrefsSchema>;

export async function extractPreferences(userId: number, narrative: string): Promise<ExtractedPrefs | null> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY not set — skipping extractPreferences');
    return null;
  }

  const prompt = `Extract structured movie preferences from this user's narrative description:

"${narrative}"

Identify their preferred genres, year range, moods/vibes, themes to avoid, runtime preference, and preferred languages.`;

  const result = await generateObject({
    model: LLM_MODEL,
    schema: ExtractedPrefsSchema,
    prompt,
    temperature: 0,
  });

  const prefs = result.object;

  await db
    .update(users)
    .set({
      extractedPrefs: JSON.stringify(prefs),
      prefsExtractedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(users.id, userId));

  return prefs;
}

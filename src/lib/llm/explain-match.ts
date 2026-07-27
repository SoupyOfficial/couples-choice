import { db } from '../../db/index';
import { users, movies } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { generateObject } from 'ai';
import { z } from 'zod';
import { LLM_MODEL } from './provider';

const ExplanationSchema = z.object({
  explanation: z.string().describe('A 1-2 sentence natural language explanation of why both users would enjoy this movie'),
});

export async function explainMatch(user1Id: number, user2Id: number, movieId: number): Promise<string | null> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY not set — skipping explainMatch');
    return null;
  }

  const [user1, user2, movie] = await Promise.all([
    db.select({ extractedPrefs: users.extractedPrefs }).from(users).where(eq(users.id, user1Id)).limit(1),
    db.select({ extractedPrefs: users.extractedPrefs }).from(users).where(eq(users.id, user2Id)).limit(1),
    db.select({ llmTags: movies.llmTags, title: movies.title }).from(movies).where(eq(movies.id, movieId)).limit(1),
  ]);

  const prefs1 = user1[0]?.extractedPrefs ? JSON.parse(user1[0].extractedPrefs) : null;
  const prefs2 = user2[0]?.extractedPrefs ? JSON.parse(user2[0].extractedPrefs) : null;
  const tags = movie[0]?.llmTags ? JSON.parse(movie[0].llmTags) : null;

  if (!prefs1 || !prefs2 || !tags || !movie[0]?.title) {
    return null;
  }

  const prompt = `User 1 preferences: ${JSON.stringify(prefs1)}
User 2 preferences: ${JSON.stringify(prefs2)}
Movie "${movie[0].title}" tags: ${JSON.stringify(tags)}

Write a 1-2 sentence natural language explanation of why both users would enjoy this movie based on their preferences and the movie's characteristics.`;

  const result = await generateObject({
    model: LLM_MODEL,
    schema: ExplanationSchema,
    prompt,
    temperature: 0,
  });

  return result.object.explanation;
}

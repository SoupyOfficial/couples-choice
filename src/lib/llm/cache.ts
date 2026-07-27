import { db } from '../../db/index';
import { llmCache } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function getCachedResponse(cacheKey: string): Promise<string | null> {
  const [entry] = await db
    .select({
      response: llmCache.response,
      ttlSeconds: llmCache.ttlSeconds,
      createdAt: llmCache.createdAt,
    })
    .from(llmCache)
    .where(eq(llmCache.cacheKey, cacheKey))
    .limit(1);

  if (!entry) {
    return null;
  }

  if (entry.ttlSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const createdAt = entry.createdAt instanceof Date ? Math.floor(entry.createdAt.getTime() / 1000) : entry.createdAt;
    if (now - createdAt > entry.ttlSeconds) {
      return null;
    }
  }

  return entry.response;
}

export async function setCachedResponse(cacheKey: string, response: unknown, ttlSeconds?: number): Promise<void> {
  const responseStr = typeof response === 'string' ? response : JSON.stringify(response);

  await db
    .insert(llmCache)
    .values({
      cacheKey,
      response: responseStr,
      ttlSeconds: ttlSeconds ?? null,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: llmCache.cacheKey,
      set: {
        response: responseStr,
        ttlSeconds: ttlSeconds ?? null,
        createdAt: new Date(),
      },
    });
}

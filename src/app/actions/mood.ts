"use server";

import { moodToFilters } from "@/lib/llm/mood-to-filters";
import type { MoodFilters } from "@/lib/llm/mood-to-filters";

export async function parseMoodAction(text: string): Promise<MoodFilters | null> {
  return moodToFilters(text);
}

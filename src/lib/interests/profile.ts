import { db } from "@/db";
import { interestSignals } from "@/db/schema";
import { eq, gte, lte, sql } from "drizzle-orm";

export interface DimensionScore {
  value: string;
  affinity: number;
  confidence: number;
  trend: "rising" | "stable" | "falling";
}

export interface TasteProfile {
  genres: DimensionScore[];
  vibes: DimensionScore[];
  pacing: DimensionScore[];
  emotionalTone: DimensionScore[];
  eras: DimensionScore[];
  runtimes: DimensionScore[];
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function computeTrend(
  signals: Array<{ signal: number; createdAt: Date }>,
  now: Date,
): "rising" | "stable" | "falling" {
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentSum = signals
    .filter((s) => s.createdAt >= fourteenDaysAgo)
    .reduce((sum, s) => sum + s.signal, 0);

  const olderSum = signals
    .filter((s) => s.createdAt >= thirtyDaysAgo && s.createdAt < fourteenDaysAgo)
    .reduce((sum, s) => sum + s.signal, 0);

  if (olderSum === 0) {
    return recentSum > 0 ? "rising" : recentSum < 0 ? "falling" : "stable";
  }

  const ratio = recentSum / Math.abs(olderSum);
  if (ratio > 1.2) return "rising";
  if (ratio < 0.8) return "falling";
  return "stable";
}

function applyRecencyDecay(signal: number, createdAt: Date, now: Date): number {
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays > 90) return signal * 0.25;
  if (ageDays > 30) return signal * 0.5;
  return signal;
}

export async function getUserTasteProfile(userId: number): Promise<TasteProfile> {
  const signals = await db
    .select({
      dimension: interestSignals.dimension,
      dimensionValue: interestSignals.dimensionValue,
      signal: interestSignals.signal,
      createdAt: interestSignals.createdAt,
    })
    .from(interestSignals)
    .where(eq(interestSignals.userId, userId));

  const now = new Date();

  const grouped = new Map<string, Map<string, Array<{ signal: number; createdAt: Date }>>>();

  for (const s of signals) {
    if (!grouped.has(s.dimension)) {
      grouped.set(s.dimension, new Map());
    }
    const dimMap = grouped.get(s.dimension)!;
    if (!dimMap.has(s.dimensionValue)) {
      dimMap.set(s.dimensionValue, []);
    }
    dimMap.get(s.dimensionValue)!.push(s);
  }

  function computeScores(dimension: string): DimensionScore[] {
    const dimMap = grouped.get(dimension);
    if (!dimMap) return [];

    const scores: DimensionScore[] = [];
    for (const [value, sigs] of dimMap) {
      const rawScore = sigs.reduce(
        (sum, s) => sum + applyRecencyDecay(s.signal, s.createdAt, now),
        0,
      );
      const totalSignals = sigs.length;
      const affinity = sigmoid(rawScore / Math.max(totalSignals, 1));
      const confidence = Math.min(1, totalSignals / 10);
      const trend = computeTrend(sigs, now);

      scores.push({ value, affinity, confidence, trend });
    }

    return scores.sort((a, b) => b.affinity - a.affinity);
  }

  return {
    genres: computeScores("genre"),
    vibes: computeScores("vibe"),
    pacing: computeScores("pace"),
    emotionalTone: computeScores("emotionalTone"),
    eras: computeScores("era"),
    runtimes: computeScores("runtime"),
  };
}

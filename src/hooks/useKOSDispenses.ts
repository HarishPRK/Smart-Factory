import { useEffect, useRef, useState } from "react";
import { subscribeKOSMessage } from "../services/plcService";

/**
 * KOS dispenser telemetry, forwarded from AWS IoT via the local bridge.
 *
 * Sample payloads (as published on AWS IoT):
 *   kos/dispenser/{id}/pour
 *     { event: "pour_complete", sessionId, memberName, memberTier,
 *       brand, drink, size, pouredMl, price, entitlementExhausted }
 *
 *   kos/dispenser/{id}/recommendations
 *     { memberName, headline, body, suggestedDrink, generatedAtMs }
 */

export interface KOSPourEvent {
  receivedAt: number;
  sessionId?: string;
  memberName?: string;
  memberTier?: string;
  brand?: string;
  drink?: string;
  size?: string;
  pouredMl?: number;
  price?: number;
  entitlementExhausted?: boolean;
}

export interface KOSRecommendation {
  receivedAt: number;
  memberName?: string;
  headline?: string;
  body?: string;
  suggestedDrink?: string;
  generatedAtMs?: number;
}

export interface UseKOSDispenses {
  latestPour: KOSPourEvent | null;
  latestRecommendation: KOSRecommendation | null;
  recent: KOSPourEvent[];
  totalPours: number;
  totalMl: number;
  /** Running revenue total across every pour seen this session. */
  totalRevenue: number;
  /** drink → number of pours so far (descending order kept by `topDrinks`). */
  drinkCounts: Record<string, number>;
  topDrinks: { drink: string; count: number }[];
}

const MAX_RECENT = 12;

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function parsePour(payload: unknown): KOSPourEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  return {
    receivedAt: Date.now(),
    sessionId: asString(p.sessionId),
    memberName: asString(p.memberName),
    memberTier: asString(p.memberTier),
    brand: asString(p.brand),
    drink: asString(p.drink),
    size: asString(p.size),
    pouredMl: asNumber(p.pouredMl),
    price: asNumber(p.price),
    entitlementExhausted: asBool(p.entitlementExhausted),
  };
}

function parseRecommendation(payload: unknown): KOSRecommendation | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  return {
    receivedAt: Date.now(),
    memberName: asString(p.memberName),
    headline: asString(p.headline),
    body: asString(p.body),
    suggestedDrink: asString(p.suggestedDrink),
    generatedAtMs: asNumber(p.generatedAtMs),
  };
}

export function useKOSDispenses(): UseKOSDispenses {
  const [latestPour, setLatestPour] = useState<KOSPourEvent | null>(null);
  const [latestRecommendation, setLatestRecommendation] = useState<KOSRecommendation | null>(null);
  const [recent, setRecent] = useState<KOSPourEvent[]>([]);
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({});

  // We keep totals in a ref so we don't have to derive them from `recent`
  // (which is capped at MAX_RECENT and would lose old data otherwise).
  const totalsRef = useRef({ pours: 0, ml: 0, revenue: 0 });
  const [totals, setTotals] = useState({ pours: 0, ml: 0, revenue: 0 });

  useEffect(() => {
    const unsubscribe = subscribeKOSMessage((topic, payload) => {
      const lower = topic.toLowerCase();
      if (lower.includes("/pour")) {
        const ev = parsePour(payload);
        if (!ev) return;
        setLatestPour(ev);
        setRecent((prev) => [ev, ...prev].slice(0, MAX_RECENT));
        if (ev.drink) {
          setDrinkCounts((prev) => ({
            ...prev,
            [ev.drink!]: (prev[ev.drink!] ?? 0) + 1,
          }));
        }
        totalsRef.current.pours += 1;
        totalsRef.current.ml += ev.pouredMl ?? 0;
        totalsRef.current.revenue += ev.price ?? 0;
        setTotals({ ...totalsRef.current });
      } else if (lower.includes("/recommendation")) {
        const rec = parseRecommendation(payload);
        if (rec) setLatestRecommendation(rec);
      }
    });
    return unsubscribe;
  }, []);

  const topDrinks = Object.entries(drinkCounts)
    .map(([drink, count]) => ({ drink, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return {
    latestPour,
    latestRecommendation,
    recent,
    totalPours: totals.pours,
    totalMl: totals.ml,
    totalRevenue: totals.revenue,
    drinkCounts,
    topDrinks,
  };
}

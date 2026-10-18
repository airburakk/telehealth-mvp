// Sosyal medya günlük ölçüleri — SAF modül (db/env YOK): n8n gövdesinin doğrulanması + panonun dönem özeti.
// Tablo: SocialMetricDaily (prisma/schema.prisma). Uç: POST /api/social-metrics. Okuyan: /admin/pano.
//
// Sözleşme (n8n → uygulama), tek ya da toplu:
//   { "platform": "x", "day": "2026-10-17", "metrics": { "followers": 51, "reach": 640, "likes": 12, ... } }
//   { "items": [ {…}, {…} ] }                                            (en çok MAX_ITEMS kalem)
// Kurallar: bilinmeyen platform/ölçü adı REDDEDİLİR (sessizce yutulmaz — n8n'deki yazım hatası görünür olsun);
// değer 0..MAX_VALUE tam sayı ya da null ("platform vermedi"); GÖNDERİLMEYEN alan dokunulmaz kalır (upsert'te
// yalnız gelen alanlar yazılır — Instagram 48 saat gecikmesiyle aynı gün yeniden gönderilir). Gün Türkiye takvim
// günüdür; gelecek gün (TR bugününden ileri) ve MAX_AGE_DAYS'ten eski gün reddedilir.

import type { SocialPlatformKey } from "./admin-social";

export const SOCIAL_PLATFORM_KEYS: readonly SocialPlatformKey[] = ["instagram", "facebook", "linkedin", "x", "youtube"];

export const SOCIAL_METRIC_FIELDS = [
  "followers", "reach", "views", "likes", "comments", "saves", "shares", "profileClicks", "posts",
] as const;
export type SocialMetricField = (typeof SOCIAL_METRIC_FIELDS)[number];

export const MAX_ITEMS = 50;
export const MAX_VALUE = 1_000_000_000;
export const MAX_AGE_DAYS = 400;

export interface SocialMetricInput {
  platform: SocialPlatformKey;
  day: string;
  metrics: Partial<Record<SocialMetricField, number | null>>;
}

export type ParseResult = { ok: true; items: SocialMetricInput[] } | { ok: false; error: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** ISO gün geçerli bir takvim günü mü (2026-02-30 gibi taşmaları reddeder). */
function isRealDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

function parseItem(raw: unknown, idx: number, todayTr: string): SocialMetricInput | string {
  const at = `items[${idx}]`;
  if (!isRecord(raw)) return `${at}: nesne bekleniyor`;
  const { platform, day, metrics } = raw;
  if (typeof platform !== "string" || !(SOCIAL_PLATFORM_KEYS as readonly string[]).includes(platform)) {
    return `${at}.platform: ${SOCIAL_PLATFORM_KEYS.join(" | ")} olmalı`;
  }
  if (typeof day !== "string" || !isRealDay(day)) return `${at}.day: "YYYY-MM-DD" geçerli gün olmalı`;
  if (day > todayTr) return `${at}.day: gelecek gün kabul edilmez (TR bugünü ${todayTr})`;
  const ageDays = (Date.parse(`${todayTr}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS;
  if (ageDays > MAX_AGE_DAYS) return `${at}.day: ${MAX_AGE_DAYS} günden eski`;
  if (!isRecord(metrics)) return `${at}.metrics: nesne bekleniyor`;
  const keys = Object.keys(metrics);
  if (keys.length === 0) return `${at}.metrics: en az bir ölçü gerekli`;
  const out: SocialMetricInput["metrics"] = {};
  for (const k of keys) {
    if (!(SOCIAL_METRIC_FIELDS as readonly string[]).includes(k)) return `${at}.metrics.${k}: bilinmeyen ölçü`;
    const v = metrics[k];
    if (v === null) out[k as SocialMetricField] = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_VALUE) out[k as SocialMetricField] = v;
    else return `${at}.metrics.${k}: 0..${MAX_VALUE} tam sayı ya da null olmalı`;
  }
  return { platform: platform as SocialPlatformKey, day, metrics: out };
}

/** Gövdeyi doğrular. Tek kalem ya da `items` dizisi; aynı (platform, gün) iki kez gelirse reddedilir (sıra belirsizliği). */
export function parseSocialMetricsPayload(body: unknown, todayTr: string): ParseResult {
  const list = isRecord(body) && Array.isArray(body.items) ? body.items : [body];
  if (list.length === 0) return { ok: false, error: "items boş" };
  if (list.length > MAX_ITEMS) return { ok: false, error: `en çok ${MAX_ITEMS} kalem` };
  const items: SocialMetricInput[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const r = parseItem(list[i], i, todayTr);
    if (typeof r === "string") return { ok: false, error: r };
    const key = `${r.platform}|${r.day}`;
    if (seen.has(key)) return { ok: false, error: `items[${i}]: ${r.platform} ${r.day} iki kez gönderildi` };
    seen.add(key);
    items.push(r);
  }
  return { ok: true, items };
}

// ── Pano özeti ────────────────────────────────────────────────────────────────────────────────

export type SocialMetricRow = { platform: string; day: string } & Record<SocialMetricField, number | null>;

export interface PlatformSummary {
  /** Dönemde en az bir satır var mı. */
  connected: boolean;
  /** Dönemdeki en son veri günü (TR). */
  lastDay: string | null;
  /** Son bilinen takipçi (dönem içindeki en geç dolu değer). */
  followers: number | null;
  /** Dönem içindeki ilk ve son dolu takipçi farkı; tek gün varsa null. */
  followersDelta: number | null;
  /** Dönem toplamları — hiçbir gün dolu değilse null ("—"). */
  totals: Record<Exclude<SocialMetricField, "followers">, number | null>;
}

const SUM_FIELDS = SOCIAL_METRIC_FIELDS.filter((f): f is Exclude<SocialMetricField, "followers"> => f !== "followers");

/** Son `days` TR günü (bugün dahil) için platform özetleri. Satırlar herhangi sırada gelebilir. */
export function summarizeSocialMetrics(rows: readonly SocialMetricRow[], todayTr: string, days = 7): Record<SocialPlatformKey, PlatformSummary> {
  const from = new Date(Date.parse(`${todayTr}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  const out = {} as Record<SocialPlatformKey, PlatformSummary>;
  for (const p of SOCIAL_PLATFORM_KEYS) {
    const mine = rows.filter((r) => r.platform === p && r.day >= from && r.day <= todayTr).sort((a, b) => a.day.localeCompare(b.day));
    const fol = mine.filter((r) => r.followers !== null);
    const totals = Object.fromEntries(
      SUM_FIELDS.map((f) => {
        const vals = mine.map((r) => r[f]).filter((v): v is number => v !== null);
        return [f, vals.length ? vals.reduce((a, b) => a + b, 0) : null];
      }),
    ) as PlatformSummary["totals"];
    out[p] = {
      connected: mine.length > 0,
      lastDay: mine.at(-1)?.day ?? null,
      followers: fol.at(-1)?.followers ?? null,
      followersDelta: fol.length >= 2 ? fol.at(-1)!.followers! - fol[0].followers! : null,
      totals,
    };
  }
  return out;
}

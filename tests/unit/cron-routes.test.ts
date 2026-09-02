// Cron düzeni SÖZLEŞMESİ (v6.204, 2026-09-02 — bakım nöbeti altı cron'a bölündü, kullanıcı kararı).
//
// Kilitlenenler:
//   1) vercel.json crons ↔ lib/cron-guard CRON_SCHEDULES BİREBİR (yol + zamanlama). Biri değişip
//      öteki unutulursa cron ya hiç tetiklenmez ya da belge yalan söyler.
//   2) Her cron yolunun rota dosyası var, ortak kapıyı (cronGate) kullanır ve maxDuration bildirir.
//   3) SIRA: içerik cron'ları (ingest-* ve v6.206 translate-news) Post baskısından (daily-digest) ÖNCE biter — "sabah gazetesi"
//      o gecenin içeriğini görsün. Eskiden bu sıra tek rota içindeydi; artık zamanlamayla korunur.
//   4) Doctorium deploy'unda çift koşum olmasın: her rota kapıdan geçer (BRAND_MODE no-op).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { CRON_SCHEDULES } from "@/lib/cron-guard";

const root = process.cwd();
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };

/** "m h * * *" → günün dakikası (UTC). Yalnız günlük sabit-saat ifadeleri (bizim tüm cron'larımız). */
function minuteOfDay(schedule: string): number {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(schedule);
  if (!m) throw new Error(`günlük sabit-saat cron ifadesi bekleniyordu: ${schedule}`);
  return Number(m[2]) * 60 + Number(m[1]);
}

describe("vercel.json ↔ CRON_SCHEDULES", () => {
  it("yol ve zamanlama birebir aynı (yedi cron)", () => {
    const fromVercel = Object.fromEntries(vercel.crons.map((c) => [c.path, c.schedule]));
    expect(fromVercel).toEqual(CRON_SCHEDULES);
    expect(Object.keys(CRON_SCHEDULES)).toHaveLength(7);
  });

  it("her cron yolunun rota dosyası var, cronGate kullanır, maxDuration bildirir", () => {
    for (const path of Object.keys(CRON_SCHEDULES)) {
      const file = join(root, "src", "app", path, "route.ts");
      expect(existsSync(file), `${path} → route.ts yok`).toBe(true);
      const code = readFileSync(file, "utf8");
      expect(code, `${path} ortak kapıyı (cronGate) kullanmıyor`).toContain("cronGate(");
      expect(code, `${path} maxDuration bildirmiyor`).toMatch(/export const maxDuration = \d+/);
      // Kapı atlanamaz: BRAND_MODE'u rota kendi kontrol ediyorsa kapı çiftlenmiş demektir (drift işareti).
      expect(code, `${path} BRAND_MODE'u kendisi kontrol ediyor — kapı tek yerde olmalı`).not.toContain('process.env.BRAND_MODE');
    }
  });

  it("SIRA: içerik cron'ları Post baskısından (daily-digest) önce biter", () => {
    const digest = minuteOfDay(CRON_SCHEDULES["/api/cron/daily-digest"]);
    for (const p of ["/api/cron/ingest-doctorium", "/api/cron/ingest-hukuk", "/api/cron/translate-news"]) {
      const t = minuteOfDay(CRON_SCHEDULES[p]);
      // Her içerik cron'unun bütçesi 300 sn; baskıdan en az 30 dk önce başlamalı ki bitmiş olsun.
      expect(digest - t, `${p} baskıya çok yakın (${t} → ${digest})`).toBeGreaterThanOrEqual(30);
    }
  });

  it("SIRA: özet çevirisi (translate-news) içerik toplama bittikten SONRA başlar (v6.206)", () => {
    // ingest-doctorium bütçesi 300 sn → çeviri en az 10 dk sonra başlamalı ki o gecenin kayıtlarını görsün.
    const ingest = minuteOfDay(CRON_SCHEDULES["/api/cron/ingest-doctorium"]);
    const ceviri = minuteOfDay(CRON_SCHEDULES["/api/cron/translate-news"]);
    expect(ceviri - ingest).toBeGreaterThanOrEqual(10);
  });

  it("hasta hatırlatması insanca saatte (08:00–18:00 TR) — kullanıcı kararı 10:00 TR", () => {
    const t = minuteOfDay(CRON_SCHEDULES["/api/cron/pending-docs-reminders"]) + 3 * 60; // UTC → TR
    expect(t).toBeGreaterThanOrEqual(8 * 60);
    expect(t).toBeLessThanOrEqual(18 * 60);
  });
});

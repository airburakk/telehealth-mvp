// Cron düzeni SÖZLEŞMESİ (v6.205, 2026-09-02 — bakım nöbeti altı cron'a bölündü, kullanıcı kararı; v6.206 translate-news ile yedi; 2026-09-04 ingest-dernekler ile sekiz; 2026-09-05 trial-sweep ile dokuz; 2026-09-05 ingest-europepmc + ingest-doaj ile onbir; 2026-09-05 generate-ai-summaries ile oniki).
//
// Kilitlenenler:
//   1) vercel.json crons ↔ lib/cron-guard CRON_SCHEDULES BİREBİR (yol + zamanlama). Biri değişip
//      öteki unutulursa cron ya hiç tetiklenmez ya da belge yalan söyler.
//   2) Her cron yolunun rota dosyası var, ortak kapıyı (cronGate) kullanır ve maxDuration bildirir.
//   3) SIRA: içerik cron'ları (ingest-* ve v6.206 translate-news) Post baskısından (daily-digest) ÖNCE biter — "sabah gazetesi"
//      o gecenin içeriğini görsün. Eskiden bu sıra tek rota içindeydi; artık zamanlamayla korunur.
//      ⚠️ Bütçe TEK-TİP DEĞİL (2026-09-05): çoğu içerik cron'u 300 sn, ama ingest-doctorium/ingest-doaj
//      800 sn (DEV ölçümü PubMed/DOAJ'ın gerçek süresini aşınca yükseltildi) — ≥30dk kuralı yine de
//      geçerli bir alt sınır (800 sn ≈ 13.3 dk, 30 dk pay rahat yeterli).
//   4) ZİNCİR (2026-10-02): PubMed → Europe PMC → DOAJ → tüm ingest-* → translate-news → generate-ai-summaries → daily-digest;
//      her halka bir öncekinin EN KÖTÜ bitişinden (başlangıç + maxDuration) sonra başlar. v6.206'daki "ingest-doctorium'dan 10 dk
//      sonra" testi Europe PMC/DOAJ ayrışınca yetersiz kaldı — o gecenin akademik satırları İngilizce özetle yayına girdi.
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
  it("yol ve zamanlama birebir aynı (oniki cron)", () => {
    const fromVercel = Object.fromEntries(vercel.crons.map((c) => [c.path, c.schedule]));
    expect(fromVercel).toEqual(CRON_SCHEDULES);
    expect(Object.keys(CRON_SCHEDULES)).toHaveLength(12);
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
    for (const p of [
      "/api/cron/ingest-doctorium", "/api/cron/ingest-hukuk", "/api/cron/ingest-dernekler",
      "/api/cron/translate-news", "/api/cron/ingest-europepmc", "/api/cron/ingest-doaj",
      "/api/cron/generate-ai-summaries",
    ]) {
      const t = minuteOfDay(CRON_SCHEDULES[p]);
      // Her içerik cron'unun bütçesi en az 300 sn (ingest-doctorium/ingest-doaj/generate-ai-summaries
      // 800 sn); baskıdan en az 30 dk önce BAŞLAMALI ki 800 sn'lik (≈13.3 dk) en kötü ihtimalde bile
      // bitmiş olsun.
      expect(digest - t, `${p} baskıya çok yakın (${t} → ${digest})`).toBeGreaterThanOrEqual(30);
    }
  });

  // ── Zincir sırası: "en kötü bitiş" = başlangıç + rotanın maxDuration'ı (Vercel işlevi bu tavanda kesilir) ──
  // Her halka bir sonrakinin GİRDİSİNİ üretir; sıra yalnız "başlangıç saati sonra" ile değil, öncekinin tavanda bile BİTMİŞ
  // olmasıyla kilitlenir. Yeni bir ingest-* cron'u eklenir ya da kaydırılırsa test onu otomatik kapsar.
  const maxDurationSec = (path: string): number => {
    const code = readFileSync(join(root, "src", "app", path, "route.ts"), "utf8");
    const m = /export const maxDuration = (\d+)/.exec(code);
    if (!m) throw new Error(`${path}: maxDuration bildirmiyor`);
    return Number(m[1]);
  };
  const startSec = (path: string) => minuteOfDay(CRON_SCHEDULES[path]) * 60;
  const worstEndSec = (path: string) => startSec(path) + maxDurationSec(path);
  const ingestPaths = Object.keys(CRON_SCHEDULES).filter((p) => p.startsWith("/api/cron/ingest-"));

  it("SIRA: özet çevirisi (translate-news) HER ingest-* cron'unun EN KÖTÜ bitişinden SONRA başlar (v6.206 + 2026-10-02)", () => {
    // 🪤 2026-10-02: ingest-europepmc (02:44) ve ingest-doaj (02:47) 5 Eylül'de ayrı cron'a bölünürken translate-news'in (02:40)
    // ARKASINA düştü; eski test yalnız ingest-doctorium'a baktığı için yakalamadı. Sonuç: o gecenin Europe PMC/DOAJ
    // kayıtları (cuid zamanı 02:44:14 / 02:47:40) çeviri koşusundan SONRA doğdu, ertesi geceye dek İngilizce kalıp
    // 07:45 seçkisine / 06:30 Post'a İngilizce özetle girdi.
    expect(ingestPaths.length).toBeGreaterThanOrEqual(5); // doctorium · hukuk · dernekler · europepmc · doaj
    const ceviri = startSec("/api/cron/translate-news");
    for (const p of ingestPaths) {
      expect(worstEndSec(p), `${p} en kötü ihtimalde translate-news'ten sonra bitiyor`).toBeLessThanOrEqual(ceviri);
    }
  });

  it("SIRA: tekilleştirme YÖNLÜ — PubMed (ingest-doctorium) → Europe PMC → DOAJ", () => {
    // mergeIfKnown (EPMC/DOAJ) yalnız MEVCUT kayda bakar; PubMed ingest'i (ingestQuery) DOI'ye bakmaz, yalnız kendi
    // (source, externalId) anahtarına → ters sırada aynı makale iki satır olur.
    expect(startSec("/api/cron/ingest-europepmc")).toBeGreaterThanOrEqual(worstEndSec("/api/cron/ingest-doctorium"));
    expect(startSec("/api/cron/ingest-doaj")).toBeGreaterThanOrEqual(worstEndSec("/api/cron/ingest-europepmc"));
  });

  it("SIRA: AI özeti PROAKTİF üretimi (generate-ai-summaries) TÜM ingest'lerden ve translate-news'ten SONRA başlar (2026-09-05)", () => {
    // daily-digest'in o sabahki içeriği özetli görmesi için: özet üretimi son ingest'ten sonra, Post baskısından önce
    // çalışmalı — kullanıcı bildirimi: "günlük bültenler ve Doctorium Post'lar yanlış üretiliyor" (tembel üretim
    // nedeniyle özetsiz kalıyordu). translate-news'ten sonra: AI özeti `summaryOriginal ?? summary` okur.
    const ozet = startSec("/api/cron/generate-ai-summaries");
    for (const p of [...ingestPaths, "/api/cron/translate-news"]) {
      expect(worstEndSec(p), `${p} en kötü ihtimalde generate-ai-summaries'ten sonra bitiyor`).toBeLessThanOrEqual(ozet);
    }
  });

  it("SIRA: Post baskısı (daily-digest) generate-ai-summaries'in EN KÖTÜ bitişinden sonra başlar", () => {
    expect(worstEndSec("/api/cron/generate-ai-summaries")).toBeLessThanOrEqual(startSec("/api/cron/daily-digest"));
  });

  it("hasta hatırlatması insanca saatte (08:00–18:00 TR) — kullanıcı kararı 10:00 TR", () => {
    const t = minuteOfDay(CRON_SCHEDULES["/api/cron/pending-docs-reminders"]) + 3 * 60; // UTC → TR
    expect(t).toBeGreaterThanOrEqual(8 * 60);
    expect(t).toBeLessThanOrEqual(18 * 60);
  });

  it("deneme süpürmesi (trial-sweep) insanca saatte (08:00–18:00 TR) — doktora e-posta gönderir (2026-09-05)", () => {
    const t = minuteOfDay(CRON_SCHEDULES["/api/cron/trial-sweep"]) + 3 * 60;
    expect(t).toBeGreaterThanOrEqual(8 * 60);
    expect(t).toBeLessThanOrEqual(18 * 60);
  });
});

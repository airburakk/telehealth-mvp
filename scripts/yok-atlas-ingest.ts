// YÖK ATLAS → Tıp programları veri hattı (K5, 2026-09-05). KALICI ARAÇ (tsx). Bkz. lib/yok-normalize başlığı (kaynak, alan notları).
//
//   npx tsx scripts/yok-atlas-ingest.ts                     → API'den çeker (POST /api/tercih-kilavuz/search, gövde {} → ~87 MB JSON)
//   npx tsx scripts/yok-atlas-ingest.ts --in <dosya.json>   → daha önce kaydedilmiş ham yanıtı kullanır (yeniden indirmez)
//   npx tsx scripts/yok-atlas-ingest.ts --raw-out <dosya>   → ham yanıtı repo DIŞINA da yazar (87 MB — repoya GİRMEZ)
//
// Çıktı: src/data/yok/tip-programlari-<yıl>.json  { meta, rows[] }  (yalnız birimGrupAdi === "Tıp"; ~242 satır, ~130 KB).
// Yayın kapısı: lib/yok-data YOK_SNAPSHOTS'ta 👤 approvedAt — bu betik onay VERMEZ, yalnız veri üretir.
// 🪤 Site JS-uygulama ama API düz JSON döner; tarayıcı UA + Origin + Referer başlıkları gönderilir (bot kalkanı `?page=` gibi sorgu
//    parametreli istekleri 418 ile keser → gövde `{}` ve sorgu parametresi YOK). 🪤 tsx CJS → üst düzey await yok (main sarmalı).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isTipProgram, normalizeRow, summarizeYok, type YokAtlasRaw } from "../src/lib/yok-normalize";

const API = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search";
const PAGE = "https://yokatlas.yok.gov.tr/lisans-bolum.php?b=10206";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const OUT_DIR = join(process.cwd(), "src", "data", "yok");

function arg(name: string): string | undefined { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }

async function fetchAll(): Promise<string> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json, text/plain, */*", Origin: "https://yokatlas.yok.gov.tr", Referer: PAGE },
    body: "{}",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const text = await res.text();
  if (!text.startsWith("{")) throw new Error(`JSON değil (ilk 80): ${text.slice(0, 80)}`);
  return text;
}

async function main() {
  const inFile = arg("--in"); const rawOut = arg("--raw-out");
  const text = inFile ? readFileSync(inFile, "utf-8") : await fetchAll();
  if (rawOut) writeFileSync(rawOut, text, "utf-8");
  const data = JSON.parse(text) as { content: (YokAtlasRaw & { birimGrupAdi?: string })[]; yil?: number; totalElements?: number };
  const all = data.content ?? [];
  const tip = all.filter(isTipProgram);
  if (tip.length < 100) throw new Error(`Tıp programı beklenmedik az: ${tip.length}`);
  const year = data.yil ?? tip[0]?.yil;
  if (!year) throw new Error("yıl bulunamadı");
  const rows = tip.map(normalizeRow).sort((a, b) => a.university.localeCompare(b.university, "tr-TR") || a.program.localeCompare(b.program, "tr-TR"));
  const dupes = rows.length - new Set(rows.map((r) => r.code)).size;
  if (dupes) throw new Error(`kilavuzKodu tekrarı: ${dupes}`);
  const summary = summarizeYok(year, rows);
  mkdirSync(OUT_DIR, { recursive: true });
  const out = {
    meta: {
      year, fetchedAt: new Date().toISOString().slice(0, 10), sourceApi: API, sourcePage: PAGE,
      sourceNote: `YÖK Atlas Tercih Sihirbazı verisi; kontenjan/koşullar ${year}-YKS Yükseköğretim Programları ve Kontenjanları Kılavuzu'ndan, taban puan ve başarı sırası ${year} YKS yerleştirme sonuçlarından; gk1..gk3 önceki yıllar. Nihai kontrol ÖSYM kılavuzu.`,
      totalPrograms: all.length, tipPrograms: rows.length, filter: 'birimGrupAdi === "Tıp"',
      excludedFields: ["tustt1", "tusktp", "kpss1", "ucret", "kontenjanObs", "obkY", "kontenjanSgy", "sgyY", "kosul", "kosulList"],
    },
    rows,
  };
  const file = join(OUT_DIR, `tip-programlari-${year}.json`);
  writeFileSync(file, JSON.stringify(out), "utf-8");
  console.log(`yazıldı: ${file} — ${rows.length} program · ${summary.faculties} fakülte · ${summary.universities} üniversite · kontenjan ${summary.totals.quota} · yerleşen ${summary.totals.placed}`);
  console.log("kontenjan yıllara göre:", summary.quotaByYear.map((q) => `${q.year}:${q.quota}`).join(" · "));
  console.log("tür:", summary.byType.map((t) => `${t.type} ${t.programs}p/${t.quota}k`).join(" · "), "| akredite:", summary.accredited);
}
main().catch((e) => { console.error(e); process.exit(1); });

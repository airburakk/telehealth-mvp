import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { translateTitlesTr } from "@/lib/translate-news";

// 🔴 GEÇİCİ UÇ (2026-09-02) — akademik başlık backfill'i. lib/translate-news.ts ingest hattı
// yalnız YENİ kayıtları Türkçe doğurur (doctorium-ingest.ts / doctorium-academic-sources.ts);
// bu uç GEÇMİŞTE kalan (titleOriginal:null) kayıtları temizler. scripts/translate-titles-backfill.ts
// ile AYNI mantık — o script src/lib/db.ts'teki AURA_DB_GUARD'a takılıyor (yerel süreçten PROD'a
// bağlanamıyor); bu uç GERÇEK production runtime'ında (NODE_ENV=production) çalıştığı için guard
// zaten devre dışı. Manuel tetiklenir, cron DEĞİL. ⚠️ Birikinti sıfırlanınca bu dosya SİLİNMELİDİR.
//
// Auth: purge-deleted cron'uyla AYNI CRON_SECRET deseni (anonim tetiklenemez, yeni sır gerekmez).
// Varsayılan dryRun:true — yazma yalnız body'de açıkça {"dryRun":false} verilince olur.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 200); // tavan: tek çağrıda maxDuration aşılmasın
  const dryRun = body.dryRun !== false; // varsayılan GÜVENLİ: DB'ye yazmaz

  const toplam = await db.newsArticle.count({ where: { module: "akademik", titleOriginal: null } });
  const rows = await db.newsArticle.findMany({
    where: { module: "akademik", titleOriginal: null },
    select: { id: true, title: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  if (!rows.length) {
    return NextResponse.json({ toplam, buKosuda: 0, cevrildi: 0, atlandi: 0, dryRun });
  }

  const ceviriler = await translateTitlesTr(rows.map((r) => r.title));
  let cevrildi = 0;
  let atlandi = 0; // zaten Türkçe / çeviri gelmedi (fail-open)
  const ornekler: { once: string; sonra: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const tr = ceviriler[i];
    if (!tr) {
      atlandi++;
      continue;
    }
    if (!dryRun) {
      await db.newsArticle.update({
        where: { id: rows[i].id },
        data: { title: tr, titleOriginal: rows[i].title },
      });
    }
    if (ornekler.length < 10) ornekler.push({ once: rows[i].title.slice(0, 80), sonra: tr.slice(0, 80) });
    cevrildi++;
  }

  return NextResponse.json({ toplam, buKosuda: rows.length, cevrildi, atlandi, dryRun, ornekler });
}

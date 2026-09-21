import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { pickSocialDigest, rotationBranchFor, SOCIAL_WINDOW_MS } from "@/lib/social-digest";
import { trDayString } from "@/lib/daily-digest";

// GET /api/social-digest — kamuya açık gazete seçkisinin MAKİNE ucu (2026-08-30, belge §2.2).
// Tüketici: n8n (otomasyon.doctorium.tr) — sabah çağırır, JSON'u sosyal kanallara dağıtır.
// Self-auth ([[api-routes-need-self-auth]]): Bearer SOCIAL_DIGEST_TOKEN — env yoksa uç DORMANT
// (503, CRON_SECRET deseni); yanlış anahtar 401. İçerik kişisel veri İÇERMEZ (NewsArticle
// metadata'sı) ama anahtar yine de var: seçki formatı ürün yüzeyidir, anonim kazınmasın.
// Determinizm: rotasyon gün etiketinden (aynı TR günü aynı branş); pencere ve tazelik eşiği koşu
// anına görelidir (48 saat seçki penceresi · 24 saat "o gün gelen" — lib/social-digest 🔁 kuralı,
// 2026-09-21: tazesi olmayan akış dünkü başlığı tekrarlamaz, en yoğun akıştan donör alır; `items[].replaces`
// / `stale` bunu söyler, `fill` sayaçları özetler). Sıralama ikincil id'li —
// [[prisma-cursor-sayfalama-tuzagi]] tek-alanlı orderBy dersi.
export const dynamic = "force-dynamic";

function tokenOk(req: Request, secret: string): boolean {
  const h = req.headers.get("authorization") ?? "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const secret = process.env.SOCIAL_DIGEST_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: "SOCIAL_DIGEST_TOKEN tanımlı değil — uç devre dışı." }, { status: 503 });
  }
  if (!tokenOk(req, secret)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const now = new Date();
  const day = trDayString();
  const rotation = rotationBranchFor(day);
  const articles = await db.newsArticle.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - SOCIAL_WINDOW_MS) } },
    select: {
      id: true, source: true, module: true, kind: true, title: true, sourceName: true,
      summary: true, url: true, branchSlugs: true, publishedAt: true, createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });

  const items = pickSocialDigest(articles, rotation, now);
  return NextResponse.json(
    {
      day,
      rotationBranch: { key: rotation.key, label: rotation.label },
      platformUrl: "https://doctorium.tr",
      items,
      // Kart/arşiv tarafı için özet: kaç yuva donörle doldu, kaçı eski başlıkla kaldı.
      fill: {
        replaced: items.filter((i) => i.replaces).length,
        stale: items.filter((i) => i.stale).length,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

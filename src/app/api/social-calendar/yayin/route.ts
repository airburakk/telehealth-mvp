import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reqMeta } from "@/lib/audit";
import { todayIsoTr } from "@/lib/iso-day";
import { PlanError, claimForPublish, dueForDay, getItem, markPublishFailed, markPublished } from "@/lib/social-calendar/plan";

// İçerik takvimi MAKİNE yüzeyi (v6.334, 2026-10-06; Faz 2-B): otomasyonun (kart → n8n) bugünün ONAYLI içeriğini okuması/alması ve yayın sonucunu bildirmesi.
// Self-auth ([[api-routes-need-self-auth]]): Bearer CONTENT_PLAN_TOKEN — env yoksa uç DORMANT (503; social-digest/CRON_SECRET deseni), yanlış jeton 401.
// AYRI jeton: SOCIAL_DIGEST_TOKEN yalnız-okuma özet/önizleme olarak kalır (yuva durumunu DEĞİŞTİREMEZ). Jeton yalnız kartta (.env.kart) ve Vercel doctorium
// env'inde yaşar; n8n'e girmez.
// Eylemler (tek POST, `action` alanı):
//   bak   — YALNIZ OKUMA (durum DEĞİŞMEZ): o günün yayına hazır içeriği + atlananlar + yuva durumları → KURU prova (çiz + arşivle) ve izleme. Her gün için serbest.
//           Her öğe `render` taşır: kartın çizeceği gövde, önizlemeyle AYNI işlevden (yayınlanan görsel = onaylanan önizleme; kart rubrik adını/şablonunu bilmez).
//   al    — KİLİTLE: o günün hazır içeriği APPROVED → YAYINLANIYOR (en fazla BİR KEZ yayın). YALNIZ bugün (TR) alınır. Dönen `version` yenidir.
//   sonuc — `durum:"ok"` (kanallar [+ basarisiz]) → YAYINLANDI · `durum:"hata"` → YAYIN HATASI. Yalnız ALINMIŞ içerik için; İDEMPOTENT (aynı sonuç ikinci kez → 200 `tekrar:true`).
// "Yayınlanan = onaylanan": içerik onay mührüyle eşleşmiyorsa hiçbir eylem onu YAYINA vermez/yayınlandı işaretlemez (lib/social-calendar/plan).
// Durum kodları: 401/503 jeton · 400 geçersiz istek · 404 yuva yok · 409 geçiş yasak/sürüm çakışması. Beklenmeyen hata 500, İÇ MESAJ SIZDIRMAZ.
export const dynamic = "force-dynamic";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function tokenOk(req: Request, secret: string): boolean {
  const h = req.headers.get("authorization") ?? "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

type MachineCtx = { actor: null; ip?: string | null; userAgent?: string | null };

/** Sonuç bildirimi. İDEMPOTENT: aynı sonuç ikinci kez gelirse (kart/n8n ağ yeniden denemesi) zaten o durumdaysa başarı sayılır. */
async function sonuc(b: Record<string, unknown>, ctx: MachineCtx): Promise<NextResponse> {
  const id = str(b.id);
  const durum = str(b.durum);
  if (durum !== "ok" && durum !== "hata") return NextResponse.json({ error: "`durum` 'ok' ya da 'hata' olmalı." }, { status: 400 });
  try {
    const item =
      durum === "ok"
        ? await markPublished({ id, expectedVersion: str(b.version), channels: b.kanallar, failures: b.basarisiz, manual: false, ...ctx })
        : await markPublishFailed({ id, expectedVersion: str(b.version), error: str(b.hata), ...ctx });
    return NextResponse.json({ ok: true, durum: item.status, version: item.version });
  } catch (e) {
    if (e instanceof PlanError && e.status === 409) {
      const cur = await getItem(id);
      const beklenen = durum === "ok" ? "PUBLISHED" : "FAILED";
      // yalnız OTOMASYONUN kendi sonucu tekrar sayılır; editör elle işaretlediyse (manual:true) çakışma gerçektir → 409 aynen yansır
      if (cur && cur.status === beklenen && cur.publication?.manual === false) return NextResponse.json({ ok: true, tekrar: true, durum: cur.status, version: cur.version });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const secret = process.env.CONTENT_PLAN_TOKEN;
  if (!secret) return NextResponse.json({ error: "CONTENT_PLAN_TOKEN tanımlı değil — uç devre dışı." }, { status: 503 });
  if (!tokenOk(req, secret)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ctx: MachineCtx = { actor: null, ...reqMeta(req) };

  try {
    switch (str(b.action)) {
      case "bak":
        return NextResponse.json({ ok: true, ...(await dueForDay(str(b.gun))) });
      case "al":
        return NextResponse.json({ ok: true, ...(await claimForPublish({ gun: str(b.gun), bugun: todayIsoTr(), ...ctx })) });
      case "sonuc":
        return await sonuc(b, ctx);
      default:
        return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof PlanError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("icerik-takvimi/yayin: beklenmeyen hata", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
  }
}

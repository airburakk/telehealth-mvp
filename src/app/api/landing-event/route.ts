import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isLandingEventName, isLandingPlacement } from "@/lib/doctorium-landing/events";

// Doctorium landing analytics ucu — FIRST-PARTY AGREGAT (2026-08-23, DOCV2-010; kullanıcı kararı).
//
// Desen: /api/csp-report (oturumsuz salt-yazar telemetri; rate-limit + gövde sınırı + daima 204).
// Gövde: {"name": <LANDING_EVENT_NAMES>, "placement": <LANDING_PLACEMENTS>} — iki alan da ALLOWLIST;
// dışı sessizce düşer (tarayıcıya geri bildirim anlamsız, saldırgana bilgi vermez).
//
// ⚠️ ASLA-LOGLAMA / ASLA-SAKLAMA: IP yalnız rate-limit anahtarında kullanılır, DB'ye yazılmaz.
// Çerez, UA, referer, URL, tercih, sorgu — hiçbiri okunmaz. Satır = (name, placement, gün) + sayı.
// Bu yüzden kişisel veri işlenmez; anonim ziyaretçiye onam kapısı kurulmaz (lib/consent-config.ts
// yalnız oturumlu akış içindir). lib/audit.ts zincirine YAZILMAZ (yüksek-frekanslı mekanik olay).
//
// Hata = sessiz: DB yoksa/çökerse 204 döner, sayfa akışı etkilenmez (telemetri asla kullanıcıya
// hata sızdırmaz — csp-report ilkesi).

const MAX_BODY = 512;

/** TR günü (UTC+3, DST yok) — lib/doctorium.ts trDayStart ile aynı sınır; db import'unu bu rotaya
 *  getirmemek için burada tekrarlanmadı, sayaç günü kendi başına hesaplar. */
function trDay(): Date {
  const TR_OFFSET_MS = 3 * 3_600_000;
  const dayStartUtc = Math.floor((Date.now() + TR_OFFSET_MS) / 86_400_000) * 86_400_000 - TR_OFFSET_MS;
  // @db.Date kolonu: Prisma tarih kısmını alır; UTC gece yarısı verilir ki TR günü kaymasın.
  const d = new Date(dayStartUtc + TR_OFFSET_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function POST(req: Request) {
  const rl = await rateLimit(`landing-event:${clientIp(req)}`, 60, 60_000);
  if (rl.ok) {
    try {
      const text = await req.text();
      if (text.length <= MAX_BODY) {
        const body = JSON.parse(text) as { name?: unknown; placement?: unknown };
        if (isLandingEventName(body.name) && isLandingPlacement(body.placement)) {
          const day = trDay();
          await db.landingEvent.upsert({
            where: { name_placement_day: { name: body.name, placement: body.placement, day } },
            create: { name: body.name, placement: body.placement, day, count: 1 },
            update: { count: { increment: 1 } },
          });
        }
      }
    } catch {
      // bozuk gövde / DB hatası — telemetri ucu asla hata sızdırmaz
    }
  }
  return new NextResponse(null, { status: 204 });
}

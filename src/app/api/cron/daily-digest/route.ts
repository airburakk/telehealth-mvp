import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { runDailyDigests, type DigestRunResult } from "@/lib/daily-digest";
import { remindCongressFollows, type CongressRemindResult } from "@/lib/congress-reminder";

// GET /api/cron/daily-digest — doktora bildirim ailesi: Doctorium Post günlük özet baskısı
// (v6.159, "sabah gazetesi") + etkinlik/kongre alarmı (v6.49/v6.62 üç eşik).
//
// v6.204 (2026-09-02): purge-deleted bakım nöbetinden AYRILDI (kullanıcı kararı "bölelim"; plan Pro).
// 03:30 UTC = 06:30 TR — "sabah gazetesi" zamanlaması KORUNDU. BİLİNÇLİ SIRA artık rota içi değil
// zamanlamayla: içerik cron'ları (ingest-doctorium 05:00 · ingest-hukuk 05:20 TR, kendi 300 sn
// bütçeleriyle) bu koşudan önce biter → baskı o gecenin içeriğini görür (lib/cron-guard
// CRON_SCHEDULES + cron-routes sözleşme testi bu sırayı kilitler). Doktor+gün idempotensi lib içinde
// (yeniden koşum ikinci baskı üretmez). Bülten AURA projesinden gider; linkleri DOCTORIUM_CANONICAL_URL
// (v6.197), çıkış token'ı DB'de (v6.198) — projeler arası sır paritesi gerekmez.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "daily-digest");
  if (gate) return gate;

  const failures: string[] = [];

  let digest: DigestRunResult | { error: string };
  try {
    digest = await runDailyDigests();
  } catch (e) {
    digest = { error: errText(e, "günlük özet koşamadı") };
    failures.push(`post: ${digest.error}`);
  }

  let congress: CongressRemindResult | { error: string };
  try {
    congress = await remindCongressFollows();
  } catch (e) {
    congress = { error: errText(e, "etkinlik alarmı koşamadı") };
    failures.push(`etkinlik: ${congress.error}`);
  }

  const pst = "error" in digest
    ? `hata: ${digest.error}`
    : `abone=${digest.checked} baski=${digest.produced} eposta=${digest.emailed}${digest.emailSimulated ? `(sim=${digest.emailSimulated})` : ""} bos=${digest.skippedEmpty} tekrar=${digest.skippedDone} hata=${digest.failed}`;
  const con = "error" in congress
    ? `hata: ${congress.error}`
    : `bakilan=${congress.checked} baslangic=${congress.start} bildiri=${congress.abstract} erkenkayit=${congress.earlybird} hata=${congress.failed}`;

  await recordAccess({
    actor: null,
    action: "CRON_MAINTENANCE",
    resourceType: "SYSTEM",
    resourceId: "daily-digest",
    subjectUserId: null,
    detail: `post ${pst} · etkinlik ${con}`,
  });

  if (failures.length) {
    void sendAlert("cron-daily-digest", `daily-digest — ${failures.length} iş koşamadı`, failures.join(" | ").slice(0, 400));
  }

  return NextResponse.json({ ok: failures.length === 0, dailyDigest: digest, congressAlerts: congress });
}

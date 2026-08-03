import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Kongre takvim dosyası (.ics) — v6.62, kullanıcı isteği "takvime ekle".
//
// Dış servis YOK: RFC 5545 metnini kendimiz üretiyoruz (Google Calendar linki kullanmak
// kongre bilgisini üçüncü tarafa taşırdı; ayrıca doktorun Outlook/Apple kullanımını dışlardı).
// PHI YOK — içerik tamamen kamuya açık kongre bilgisi.
//
// Self-auth: middleware /api'yi korumaz → rota kendi kapısını kurar (personel + doktor okuyabilir;
// kongre verisi hassas değil ama uç noktayı anonim taramaya açmayız).

export const dynamic = "force-dynamic";

/** RFC 5545 metin kaçışı: ters bölü, noktalı virgül, virgül ve satır sonu. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Tüm-gün etkinlik için YYYYMMDD (DTEND takvimlerde HARİÇ sayılır → +1 gün verilir). */
function dateOnly(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function stamp(d: Date): string {
  return `${dateOnly(d)}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
}

/** 75 oktetlik satır katlama (RFC 5545); katlanan satır tek boşlukla başlar. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = rest.slice(73);
  }
  parts.push(rest);
  return parts.join("\r\n ");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return new Response("Yetkisiz.", { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  const c = id ? await db.medicalCongress.findUnique({ where: { id } }) : null;
  if (!c) return new Response("Kongre bulunamadı.", { status: 404 });

  // Bitiş yoksa tek günlük kabul edilir. DTEND hariç olduğu için daima +1 gün.
  const end = new Date((c.endDate ?? c.startDate).getTime() + 86400000);

  const desc = [
    c.organizer ? `Düzenleyen: ${c.organizer}` : null,
    c.abstractDeadline ? `Bildiri son gönderim: ${c.abstractDeadline.toISOString().slice(0, 10)}` : null,
    c.earlyBirdDeadline ? `Erken kayıt son tarih: ${c.earlyBirdDeadline.toISOString().slice(0, 10)}` : null,
    c.url ? `Resmî site: ${c.url}` : null,
    "Tarih ve ücretler değişebilir — katılmadan önce resmî siteden teyit edin.",
  ].filter(Boolean).join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AURA//Doctorium Kongre//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:congress-${c.id}@aura.health`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART;VALUE=DATE:${dateOnly(c.startDate)}`,
    `DTEND;VALUE=DATE:${dateOnly(end)}`,
    fold(`SUMMARY:${esc(c.title)}`),
    fold(`DESCRIPTION:${esc(desc)}`),
    ...(c.city || c.venue ? [fold(`LOCATION:${esc([c.venue, c.city, c.country].filter(Boolean).join(", "))}`)] : []),
    ...(c.url ? [fold(`URL:${esc(c.url)}`)] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // ⚠️ CRLF zorunlu (RFC 5545): LF ile bazı takvim istemcileri dosyayı reddediyor.
  const body = lines.join("\r\n") + "\r\n";
  const fileName = `kongre-${c.id}.ics`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

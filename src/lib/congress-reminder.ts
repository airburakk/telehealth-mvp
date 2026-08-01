// Doctorium Modül E — kongre alarmı (v6.49). Günlük bakım cron'u (purge-deleted) çağırır.
//
// İKİ AYRI ALARM (kullanıcı isteği): hekim ikisini ayrı ayrı ayarlar, çünkü zamanlamaları farklıdır —
//   1) "start"    → kongrenin BAŞLANGICI yaklaşıyor (Doctor.congressAlertDays)
//   2) "deadline" → bildiri teslim / erken kayıt SON TARİHİ yaklaşıyor (Doctor.congressDeadlineAlertDays)
//      Kongreye 2 ay varken bildiri süresi dolabilir; tek eşik ikisini de doğru yakalayamaz.
//
// TEKRAR KORUMASI: gönderilen alarm türü CongressFollow.sentAlerts'a yazılır → her gün yeniden
// gönderilmez. (DOCS_PENDING hatırlatmasında bildirim kaydından türetmiştik; burada takip satırı
// zaten var, açık kayıt daha ucuz ve okunaklı.)
//
// Alarm KRİTİK DEĞİL: hata imha akışını düşürmez, cron yanıtında raporlanır.
import { db } from "./db";
import { notifyUser } from "./notify";

export interface CongressRemindResult {
  checked: number; // incelenen takip satırı
  start: number; // gönderilen başlangıç alarmı
  deadline: number; // gönderilen son-tarih alarmı
  failed: number;
}

/** Gün farkı (bugünün 00:00'ına göre) — saat farkları eşiği kaydırmasın. */
function daysUntil(target: Date, now: Date): number {
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86400000);
}

function parseSent(raw: string): Set<string> {
  try {
    const v = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function fmt(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function remindCongressFollows(now = new Date()): Promise<CongressRemindResult> {
  const out: CongressRemindResult = { checked: 0, start: 0, deadline: 0, failed: 0 };

  const follows = await db.congressFollow.findMany({
    select: { id: true, doctorId: true, congressId: true, sentAlerts: true },
  });
  if (!follows.length) return out;

  // Takip edilen kongreler + alarm tercihi olan hekimler tek seferde çekilir (N+1 yok).
  const doctorIds = [...new Set(follows.map((f) => f.doctorId))];
  // NOT: User modelinde `doctor` İLİŞKİSİ yok (yalnız `doctorId` skaları) → üç sorgu ayrı ayrı.
  const [congresses, users, doctors] = await Promise.all([
    db.medicalCongress.findMany({
      where: { id: { in: [...new Set(follows.map((f) => f.congressId))] } },
      select: { id: true, title: true, startDate: true, abstractDeadline: true, earlyBirdDeadline: true },
    }),
    db.user.findMany({ where: { doctorId: { in: doctorIds } }, select: { id: true, doctorId: true } }),
    db.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, congressAlertDays: true, congressDeadlineAlertDays: true },
    }),
  ]);
  const byCongress = new Map(congresses.map((c) => [c.id, c]));
  const userByDoctor = new Map(users.filter((u) => u.doctorId).map((u) => [u.doctorId as string, u]));
  const prefByDoctor = new Map(doctors.map((d) => [d.id, d]));

  for (const f of follows) {
    const c = byCongress.get(f.congressId);
    const u = userByDoctor.get(f.doctorId);
    const pref = prefByDoctor.get(f.doctorId);
    if (!c || !u || !pref) continue; // kongre silinmiş veya hekimin User kaydı yok
    out.checked++;

    const sent = parseSent(f.sentAlerts);
    const startDays = pref.congressAlertDays;
    const deadlineDays = pref.congressDeadlineAlertDays;

    // (1) Başlangıç alarmı — eşiğe girdiyse ve henüz gönderilmediyse. Geçmiş kongre atlanır.
    if (startDays != null && !sent.has("start")) {
      const d = daysUntil(c.startDate, now);
      if (d >= 0 && d <= startDays) {
        try {
          await notifyUser(u.id, {
            type: "CONGRESS_ALERT",
            title: "📅 Takip ettiğiniz kongre yaklaşıyor",
            body: `${c.title} — ${d === 0 ? "bugün başlıyor" : `${d} gün kaldı`} (${fmt(c.startDate)}).`,
            href: "/doktor/doctorium?m=kongre",
          });
          sent.add("start");
          out.start++;
        } catch {
          out.failed++;
        }
      }
    }

    // (2) Son tarih alarmı — bildiri teslim ve erken kayıttan hangisi ÖNCE geliyorsa o.
    if (deadlineDays != null && !sent.has("deadline")) {
      const candidates = [
        { d: c.abstractDeadline, label: "Bildiri teslim" },
        { d: c.earlyBirdDeadline, label: "Erken kayıt" },
      ].filter((x): x is { d: Date; label: string } => !!x.d);
      const next = candidates
        .map((x) => ({ ...x, days: daysUntil(x.d, now) }))
        .filter((x) => x.days >= 0 && x.days <= deadlineDays)
        .sort((a, b) => a.days - b.days)[0];
      if (next) {
        try {
          await notifyUser(u.id, {
            type: "CONGRESS_ALERT",
            title: "⏳ Kongre son tarihi yaklaşıyor",
            body: `${c.title} — ${next.label} için ${next.days === 0 ? "son gün" : `${next.days} gün kaldı`} (${fmt(next.d)}).`,
            href: "/doktor/doctorium?m=kongre",
          });
          sent.add("deadline");
          out.deadline++;
        } catch {
          out.failed++;
        }
      }
    }

    if (sent.size !== parseSent(f.sentAlerts).size) {
      await db.congressFollow.update({ where: { id: f.id }, data: { sentAlerts: JSON.stringify([...sent]) } });
    }
  }

  return out;
}

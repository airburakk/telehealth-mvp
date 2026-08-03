// Doctorium Modül E — kongre alarmı (v6.49; v6.62'de ÜÇ EŞİĞE ayrıldı). Günlük bakım cron'u
// (purge-deleted) çağırır.
//
// ÜÇ AYRI ALARM (kullanıcı isteği v6.62) — doktor üçünü ayrı ayrı ayarlar, zamanlamaları farklı:
//   1) "start"     → kongrenin BAŞLANGICI yaklaşıyor        (Doctor.congressAlertDays)
//   2) "abstract"  → BİLDİRİ son gönderim yaklaşıyor        (Doctor.congressAbstractAlertDays)
//   3) "earlybird" → ERKEN KAYIT son tarihi yaklaşıyor      (Doctor.congressEarlyBirdAlertDays)
// Gerekçe: bildiri hazırlamak haftalar sürer (erken uyarı ister), erken kayıt tek işlemdir
// (kısa uyarı yeter), kongre başlangıcı ise seyahat planı içindir. v6.49'da 2+3 tek eşikteydi ve
// "hangisi önce gelirse o" mantığıyla BİRİ gönderilince öbürü susuyordu — gerçek kayıp riski.
// Eşikler her kongrenin KENDİ tarihine uygulanır (kongre başına tarihler farklı).
//
// TEKRAR KORUMASI: gönderilen alarm türü CongressFollow.sentAlerts'a yazılır → her gün yeniden
// gönderilmez. (DOCS_PENDING hatırlatmasında bildirim kaydından türetmiştik; burada takip satırı
// zaten var, açık kayıt daha ucuz ve okunaklı.)
// 🔁 Geriye uyum: v6.49'un "deadline" işareti eski takiplerde duruyor olabilir; yeni türler
// ("abstract"/"earlybird") ayrı anahtarlar olduğu için eski işaret yeni alarmları ENGELLEMEZ.
//
// Alarm KRİTİK DEĞİL: hata imha akışını düşürmez, cron yanıtında raporlanır.
import { db } from "./db";
import { notifyUser } from "./notify";

export interface CongressRemindResult {
  checked: number; // incelenen takip satırı
  start: number; // gönderilen başlangıç alarmı
  abstract: number; // gönderilen bildiri son-tarih alarmı (v6.62)
  earlybird: number; // gönderilen erken kayıt alarmı (v6.62)
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
  const out: CongressRemindResult = { checked: 0, start: 0, abstract: 0, earlybird: 0, failed: 0 };

  const follows = await db.congressFollow.findMany({
    select: { id: true, doctorId: true, congressId: true, sentAlerts: true },
  });
  if (!follows.length) return out;

  // Takip edilen kongreler + alarm tercihi olan doktorlar tek seferde çekilir (N+1 yok).
  const doctorIds = [...new Set(follows.map((f) => f.doctorId))];
  // NOT: User modelinde `doctor` İLİŞKİSİ yok (yalnız `doctorId` skaları) → üç sorgu ayrı ayrı.
  const [congresses, users, doctors] = await Promise.all([
    db.medicalCongress.findMany({
      where: { id: { in: [...new Set(follows.map((f) => f.congressId))] } },
      select: { id: true, title: true, startDate: true, abstractDeadline: true, earlyBirdDeadline: true },
      // NOT: kongre kartına derin bağlantı için id yeterli (/doktor/doctorium/kongre/[id]).
    }),
    db.user.findMany({ where: { doctorId: { in: doctorIds } }, select: { id: true, doctorId: true } }),
    db.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: {
        id: true,
        congressAlertDays: true,
        congressAbstractAlertDays: true,
        congressEarlyBirdAlertDays: true,
      },
    }),
  ]);
  const byCongress = new Map(congresses.map((c) => [c.id, c]));
  const userByDoctor = new Map(users.filter((u) => u.doctorId).map((u) => [u.doctorId as string, u]));
  const prefByDoctor = new Map(doctors.map((d) => [d.id, d]));

  for (const f of follows) {
    const c = byCongress.get(f.congressId);
    const u = userByDoctor.get(f.doctorId);
    const pref = prefByDoctor.get(f.doctorId);
    if (!c || !u || !pref) continue; // kongre silinmiş veya doktorun User kaydı yok
    out.checked++;

    const sent = parseSent(f.sentAlerts);
    const startDays = pref.congressAlertDays;

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

    // (2)+(3) Son tarih alarmları — v6.62: bildiri ve erken kayıt AYRI eşik, AYRI bildirim.
    // Eskiden ikisi tek eşikteydi ve "önce gelen" gönderilince öbürü susuyordu; artık her biri
    // kendi eşiğine göre bağımsız değerlendirilir (biri gönderildi diye diğeri kaçmaz).
    const deadlineKinds = [
      { key: "abstract", days: pref.congressAbstractAlertDays, date: c.abstractDeadline, label: "Bildiri son gönderim" },
      { key: "earlybird", days: pref.congressEarlyBirdAlertDays, date: c.earlyBirdDeadline, label: "Erken kayıt" },
    ] as const;

    for (const k of deadlineKinds) {
      if (k.days == null || !k.date || sent.has(k.key)) continue;
      const left = daysUntil(k.date, now);
      if (left < 0 || left > k.days) continue;
      try {
        await notifyUser(u.id, {
          type: "CONGRESS_ALERT",
          title: k.key === "abstract" ? "📝 Bildiri son tarihi yaklaşıyor" : "⏳ Erken kayıt son tarihi yaklaşıyor",
          body: `${c.title} — ${k.label} için ${left === 0 ? "son gün" : `${left} gün kaldı`} (${fmt(k.date)}).`,
          href: `/doktor/doctorium/kongre/${c.id}`,
        });
        sent.add(k.key);
        if (k.key === "abstract") out.abstract++;
        else out.earlybird++;
      } catch {
        out.failed++;
      }
    }

    if (sent.size !== parseSent(f.sentAlerts).size) {
      await db.congressFollow.update({ where: { id: f.id }, data: { sentAlerts: JSON.stringify([...sent]) } });
    }
  }

  return out;
}

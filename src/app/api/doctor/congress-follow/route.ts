import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeAlertDays, EVENT_TYPES } from "@/lib/doctorium";

const EVENT_TYPE_KEYS = new Set<string>(EVENT_TYPES.map((t) => t.key));
// 🔴 v6.142 düzeltmesi: "uluslararasi-katilimli" eksikti (lib/doctorium CongressScope üç değer
// taşır, parseScope üçünü de tanır — burası v6.132'den beri yalnız ikisini biliyordu). Sekme içi
// panel silinene dek bu hiç fark edilmedi: eski UI o üçüncü değeri hiç GÖNDERMİYORDU. Şimdi
// PreferencesBoard'un "Uluslararası katılımlı" çipi gönderiyor — eksik kalsaydı seçim sessizce
// null'a (Tümü) düşerdi ("Kaydedildi" yazar ama yanlış değer kaydedilirdi).
const SCOPE_KEYS = new Set(["ulusal", "uluslararasi", "uluslararasi-katilimli"]);

/**
 * Etkinlik türü tercihi (v6.132). Dönüş sözleşmesi ÜÇ DEĞERLİ:
 *   undefined → istemci göndermedi, kolona DOKUNMA (eski alarm-only istemcisi)
 *   null      → "hepsi" (tür süzgeci kapalı) ya da geçersiz değer → varsayılana dön
 *   string    → JSON dizi, geçerli anahtarlar
 * Boş dizi null'a düşer: sıfır türle etkinlik listesi daima boş kalırdı (fail-open).
 */
function normalizeEventTypePref(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === "hepsi") return "hepsi";
  if (!Array.isArray(raw)) return null;
  const keys = [...new Set(raw.filter((s): s is string => typeof s === "string" && EVENT_TYPE_KEYS.has(s)))];
  return keys.length ? JSON.stringify(keys) : null;
}

/** Kapsam tercihi: "ulusal" | "uluslararasi" | null (tümü). undefined = dokunma. */
function normalizeScopePref(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === "string" && SCOPE_KEYS.has(raw) ? raw : null;
}

// Doctorium Modül E (v6.49) — kongre takibi + alarm tercihleri.
// Self-auth (middleware /api'yi korumaz): yalnız DOCTOR + kendi Doctor kaydı.
async function myDoctorId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return null;
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  return me?.doctorId ?? null;
}

// POST — takip aç/kapat (body: {congressId, follow}) VEYA alarm tercihi (body: {alertDays, deadlineAlertDays}).
export async function POST(req: Request) {
  const doctorId = await myDoctorId();
  if (!doctorId) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));

  // (a) Alarm tercihleri — üç AYRI eşik (v6.62, kullanıcı isteği): başlangıç · bildiri · erken
  // kayıt. Bildiri hazırlamak haftalar sürer, erken kayıt tek işlemdir → aynı gün sayısı ikisine
  // de doğru gelmiyordu. Eşikler her kongrenin KENDİ tarihine uygulanır (lib/congress-reminder).
  // null/geçersiz = o alarm kapalı.
  if ("alertDays" in b || "abstractAlertDays" in b || "earlyBirdAlertDays" in b) {
    const congressAlertDays = normalizeAlertDays(b.alertDays);
    const congressAbstractAlertDays = normalizeAlertDays(b.abstractAlertDays);
    const congressEarlyBirdAlertDays = normalizeAlertDays(b.earlyBirdAlertDays);
    // v6.132 — tür ve kapsam TERCİHİ aynı yazımda gider (tercihler sayfası ikisini birlikte
    // gönderir). Alanlar OPSİYONEL: eski istemci (alarm-only) gönderdiğinde undefined kalır ve
    // Prisma o kolonlara dokunmaz — mevcut tercih silinmez.
    const congressEventTypes = normalizeEventTypePref(b.eventTypes);
    const congressScope = normalizeScopePref(b.scope);
    await db.doctor.update({
      where: { id: doctorId },
      data: {
        congressAlertDays, congressAbstractAlertDays, congressEarlyBirdAlertDays,
        ...(congressEventTypes !== undefined ? { congressEventTypes } : {}),
        ...(congressScope !== undefined ? { congressScope } : {}),
      },
    });
    // Eşik değişince önceki "gönderildi" işaretleri anlamını yitirir (doktor daha erken uyarılmak
    // isteyebilir) → sıfırla, yeni eşiğe göre yeniden değerlendirilsin.
    await db.congressFollow.updateMany({ where: { doctorId }, data: { sentAlerts: "[]" } });
    return NextResponse.json({ ok: true, congressAlertDays, congressAbstractAlertDays, congressEarlyBirdAlertDays });
  }

  // (b) Takip aç/kapat
  const congressId = typeof b.congressId === "string" ? b.congressId : "";
  if (!congressId) return NextResponse.json({ error: "congressId gerekli." }, { status: 400 });
  const exists = await db.medicalCongress.findUnique({ where: { id: congressId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Etkinlik bulunamadı." }, { status: 404 });

  if (b.follow === false) {
    await db.congressFollow.deleteMany({ where: { doctorId, congressId } });
    return NextResponse.json({ ok: true, following: false });
  }
  await db.congressFollow.upsert({
    where: { doctorId_congressId: { doctorId, congressId } },
    create: { doctorId, congressId },
    update: {},
  });
  return NextResponse.json({ ok: true, following: true });
}

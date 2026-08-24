import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { RANGE_OPTIONS, DEFAULT_RANGE, SECTOR_CATEGORIES } from "@/lib/doctorium";

// <string> ZORUNLU: RANGE_OPTIONS `as const` olduğundan .map(r=>r.key) literal union'ı korur
// (Set<"1"|"7"|"30"|"180"|"365">) — sonra .has(v) çalışma-zamanı string'iyle çağrılınca reddedilir.
const RANGE_KEYS = new Set<string>(RANGE_OPTIONS.map((r) => r.key));
const CATEGORY_KEYS = new Set(SECTOR_CATEGORIES.map((c) => c.key));
const MODULE_KEYS = new Set(["sektorel", "ilac", "mevzuat"]);

function normRange(v: unknown): string {
  return typeof v === "string" && RANGE_KEYS.has(v) ? v : DEFAULT_RANGE;
}
function normCategory(v: unknown): string | null {
  return typeof v === "string" && CATEGORY_KEYS.has(v) ? v : null;
}
function normSource(v: unknown): string | null {
  return v === "ulusal" || v === "uluslararasi" ? v : null;
}

// Doctorium GÖRÜNÜM SÜZGEÇLERİ kalıcı tercihi (v6.142) — Sektörel/İlaç & Cihaz/Mevzuat'ın
// Kaynak/Geriye-dönük/Kategori süzgeçleri; congress-follow'un tür/kapsam yazımıyla AYNI desen.
// Self-auth (middleware /api'yi korumaz): yalnız DOCTOR + kendi Doctor kaydı.
async function myDoctorId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return null;
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  return me?.doctorId ?? null;
}

// POST body: { module: "sektorel"|"ilac"|"mevzuat", source?, range?, category? }.
// Modülün ÜÇ alanı (Etkinlik alarmlarındaki pickAlert deseniyle aynı gerekçe) HER yazımda
// BİRLİKTE gönderilir — istemci güncel yerel state'in tamamını yollar, sunucu yalnız o modülün
// alt-nesnesini DEĞİŞTİRİR; diğer iki modülün kayıtlı tercihi dokunulmadan kalır.
export async function POST(req: Request) {
  const doctorId = await myDoctorId();
  if (!doctorId) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const moduleKey = typeof b.module === "string" ? b.module : "";
  if (!MODULE_KEYS.has(moduleKey)) {
    return NextResponse.json({ error: "Geçersiz modül." }, { status: 400 });
  }

  const current = await db.doctor.findUnique({ where: { id: doctorId }, select: { doctoriumViewPrefs: true } });
  let prefs: Record<string, unknown> = {};
  try {
    const v = current?.doctoriumViewPrefs ? JSON.parse(current.doctoriumViewPrefs) : {};
    if (v && typeof v === "object") prefs = v;
  } catch {
    /* bozuk kayıt — sıfırdan kurulur, diğer modüller de bu yazımda sıfırlanır (nadir durum) */
  }

  if (moduleKey === "sektorel") {
    prefs.sektorel = { s: normSource(b.source), d: normRange(b.range), c: normCategory(b.category) };
  } else if (moduleKey === "ilac") {
    prefs.ilac = { d: normRange(b.range) };
  } else {
    prefs.mevzuat = { d: normRange(b.range), c: normCategory(b.category) };
  }

  await db.doctor.update({ where: { id: doctorId }, data: { doctoriumViewPrefs: JSON.stringify(prefs) } });
  return NextResponse.json({ ok: true });
}

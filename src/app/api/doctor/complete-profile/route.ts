import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptField } from "@/lib/crypto";
import { DOCTOR_TITLES } from "@/lib/doctor-signup";
import { BRANCH_LABELS } from "@/lib/procedures";
import { LANGUAGES } from "@/lib/constants";
import { isAllowedCity } from "@/lib/cities";

export const dynamic = "force-dynamic";

const TITLE_SET = new Set<string>(DOCTOR_TITLES);
const BRANCH_SET = new Set(Object.values(BRANCH_LABELS));
const LANG_SET = new Set(LANGUAGES);

// POST /api/doctor/complete-profile — OAuth (Google/Apple) ile açılan doktor hesabının eksik
// kimliği: ad/ünvan/branş/şehir/telefon (v6.87). OAuth'tan yalnız ad+e-posta gelir;
// hesap branch:"" city:"" ile açılır (doctor-signup.ts) → /doktor/profil-tamamla bu uca yazar.
// Doğrulama kuralları e-posta kaydıyla (api/auth/signup) BİREBİR — iki yol aynı veri setine yakınsar.
// Self-auth: yalnız DOCTOR + kendi Doctor kaydı (BOLA yüzeyi yok). Telefon at-rest şifreli.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const title = String(b.title ?? "").trim();
  const branch = String(b.branch ?? "").trim();
  const city = String(b.city ?? "").trim().slice(0, 80);
  const phoneRaw = String(b.phone ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20);
  const phone = phoneRaw.replace(/\s+/g, " ").length >= 7 ? phoneRaw : null;
  // Hizmet dilleri profil-tamamla formundan KALDIRILDI (kullanıcı kararı 2026-08-18; kayıt
  // formundaki 2026-08-17 kararıyla aynı gerekçe) → gövde artık languages taşımaz. Alan yine de
  // kabul edilir (eski açık sekmedeki form gönderebilir); boş/geçersizse hesabın mevcut değeri
  // KORUNUR — OAuth açılışı zaten "Türkçe" yazar, doktor sonradan tercihlerinden değiştirir.
  // Eskiden 400 dönen zorunluluk kalktı, yoksa yeni form profili hiç tamamlayamazdı.
  const languages = Array.isArray(b.languages)
    ? [...new Set((b.languages as unknown[]).filter((l): l is string => typeof l === "string" && LANG_SET.has(l)))]
    : [];

  if (name.length < 2) return NextResponse.json({ error: "Ad soyad girin." }, { status: 400 });
  if (!TITLE_SET.has(title)) return NextResponse.json({ error: "Geçerli bir ünvan seçin." }, { status: 400 });
  if (!BRANCH_SET.has(branch)) return NextResponse.json({ error: "Geçerli bir branş seçin." }, { status: 400 });
  // Kapalı liste (2026-08-30) — doğrulama api/auth/signup ile BİREBİR kalır (üstteki not).
  if (!isAllowedCity(city)) return NextResponse.json({ error: "Şehri listeden seçin." }, { status: 400 });

  // Ad hem Doctor hem User'da yaşar (oturum/panel User.name okur) — atomik güncelle.
  // Telefon boş bırakıldıysa mevcut değer KORUNUR (silme değil "girmedi" anlamı; OAuth yolunda zaten null).
  await db.$transaction(async (tx) => {
    await tx.doctor.update({
      where: { id: me.doctorId! },
      data: {
        name, title, branch, city,
        ...(languages.length > 0 ? { languages: languages.join(",") } : {}),
        ...(phone ? { phone: encryptField(phone) } : {}),
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { name } });
  });

  return NextResponse.json({ ok: true });
}

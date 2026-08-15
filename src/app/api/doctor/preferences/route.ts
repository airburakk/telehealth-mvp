import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LANGUAGES, COUNTRIES } from "@/lib/constants";

const LANG_SET = new Set(LANGUAGES);
const CODE_SET = new Set(COUNTRIES.map((c) => c.code));

// Profil medya alanları: ya boş ya https URL (≤1000 kr). data:/javascript: gibi şemalar reddedilir.
function cleanMediaUrl(v: unknown): string | null | undefined {
  if (v === null) return null; // açıkça kaldır
  if (typeof v !== "string") return undefined; // gelmedi → dokunma
  const s = v.trim();
  if (!s) return null;
  if (!/^https:\/\/\S{1,1000}$/.test(s)) return undefined; // geçersiz → dokunma (sessizce yutma yerine 400 aşağıda)
  return s;
}
// Kendi Blob'umuzsa fiziken sil (dış URL'lere dokunulmaz; havuz yolu /photos/... da blob değildir).
async function delIfBlob(url: string | null) {
  if (url && url.includes(".blob.vercel-storage.com/")) {
    try { await del(url); } catch { /* silinemeyen eski medya yükleme akışını kırmasın */ }
  }
}

// POST /api/doctor/preferences — doktorun profil tercihleri. 2026-08-14'ten beri KISMİ güncelleme:
// yalnız gövdede GELEN alanlar yazılır (UI artık dil/pazar/kapasite göndermiyor — o alanlar API'de
// geriye-uyum için duruyor; bio/photo/introVideo + birim katılımı bugünkü ana yüzey).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  // ── Eski yüzey (geriye uyum): dil / pazar / kapasite — yalnız gönderilirse ──
  if (Array.isArray(b.languages)) {
    const languages = [...new Set((b.languages as unknown[]).filter((l): l is string => typeof l === "string" && LANG_SET.has(l)))];
    if (languages.length === 0) return NextResponse.json({ error: "En az bir hizmet dili seçin." }, { status: 400 });
    data.languages = languages.join(",");
  }
  if (Array.isArray(b.markets)) {
    const markets = [...new Set((b.markets as unknown[]).filter((m): m is string => typeof m === "string" && CODE_SET.has(m)))];
    data.markets = markets.length ? markets.join(",") : null;
  }
  if (b.capacity !== undefined) {
    data.capacity = Math.min(200, Math.max(1, Math.round(Number(b.capacity) || 20)));
  }

  // ── M5 — birim katılımı opt-in'leri (yalnız boolean geldiyse) ──
  if (typeof b.freeCareOptIn === "boolean") data.freeCareOptIn = b.freeCareOptIn;
  if (typeof b.consultOptIn === "boolean") data.consultOptIn = b.consultOptIn;

  // ── Yeni yüzey (2026-08-14): Hakkımda + profil medyası ──
  if (b.bio !== undefined) {
    if (b.bio !== null && typeof b.bio !== "string") return NextResponse.json({ error: "Geçersiz Hakkımda metni." }, { status: 400 });
    const bio = typeof b.bio === "string" ? b.bio.trim().slice(0, 2000) : "";
    data.bio = bio || null;
  }
  if (b.photo !== undefined) {
    const photo = cleanMediaUrl(b.photo);
    if (photo === undefined) return NextResponse.json({ error: "Geçersiz fotoğraf adresi." }, { status: 400 });
    data.photo = photo;
  }
  if (b.introVideo !== undefined) {
    const introVideo = cleanMediaUrl(b.introVideo);
    if (introVideo === undefined) return NextResponse.json({ error: "Geçersiz video adresi." }, { status: 400 });
    data.introVideo = introVideo;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true }); // hiç alan gelmedi → no-op

  // Medya değişiyorsa eski Blob'u fiziken sil (çöp birikmesin) — güncellemeden ÖNCE mevcut değeri oku.
  if (data.photo !== undefined || data.introVideo !== undefined) {
    const cur = await db.doctor.findUnique({ where: { id: dbUser.doctorId }, select: { photo: true, introVideo: true } });
    if (cur) {
      if (data.photo !== undefined && cur.photo !== data.photo) await delIfBlob(cur.photo);
      if (data.introVideo !== undefined && cur.introVideo !== data.introVideo) await delIfBlob(cur.introVideo);
    }
  }

  // Not: licenseNo (FHIR Practitioner.identifier) /api/doctor/academic'te yönetilir — burada dokunulmaz.
  await db.doctor.update({ where: { id: dbUser.doctorId }, data });

  return NextResponse.json({ ok: true });
}

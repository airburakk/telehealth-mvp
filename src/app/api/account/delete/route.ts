import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { reqMeta } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { deleteAccount, RETENTION_YEARS } from "@/lib/account-deletion";

// POST /api/account/delete — hasta kendi hesabını ve kişisel verilerini siler (KVKK m.7 / GDPR m.17).
// body: { confirm: "SİL" }
//
// GERİ DÖNÜŞÜ YOKTUR. Ne olduğu lib/account-deletion başında: kişisel katman gerçekten silinir,
// klinik katman yasal saklama süresi boyunca KİLİTLİ durur (kimse açamaz) ve süre sonunda cron imha eder.
//
// YALNIZ KENDİ HESABI: `requireUser` + userId oturumdan türetilir (gövdeden ALINMAZ) → bir kullanıcı
// başkasının hesabını silemez. Personel (doktor/koordinatör/admin) bu uçtan hesap silemez: silme talebi
// hastanın kendi iradesidir; ayrıca personel hesabının silinmesi klinik kayıt sahipliğini bozar → 403.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  // Yıkıcı + geri dönüşsüz → dar limit (kaza/otomasyon tekrarına karşı; idempotent olsa da).
  const limited = await rateLimit(`account-delete:${user.id}`, 3, 60 * 60);
  if (!limited.ok) return NextResponse.json({ error: "Çok fazla deneme. Lütfen sonra tekrar deneyin." }, { status: 429 });

  if (user.role !== "PATIENT") {
    return NextResponse.json({ error: "Bu uç yalnız hasta hesapları içindir." }, { status: 403 });
  }
  // Bürünme (master) ile silme YASAK — geri dönüşsüz bir işlemi kullanıcı adına başkası tetikleyemez.
  if (user.imp) {
    return NextResponse.json({ error: "Bürünme oturumunda hesap silinemez." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  if (b?.confirm !== "SİL") {
    return NextResponse.json({ error: 'Onay gerekli: { confirm: "SİL" }' }, { status: 400 });
  }

  const meta = reqMeta(req);
  const r = await deleteAccount(user, meta.ip, meta.userAgent);
  if (!r.ok) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

  // Oturum çerezini de düşür — sessionVersion zaten token'ları geçersiz kıldı, bu tarayıcıyı da temizler.
  const res = NextResponse.json({
    ok: true,
    alreadyDeleted: r.alreadyDeleted ?? false,
    lockedCases: r.lockedCases,
    lockedSoCases: r.lockedSoCases,
    retentionYears: RETENTION_YEARS,
  });
  res.cookies.set("session", "", { maxAge: 0, path: "/" });
  return res;
}

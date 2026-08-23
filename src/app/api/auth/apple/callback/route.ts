import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { roleHome, type Role } from "@/lib/session";
import { patientHome } from "@/lib/patient-journey";
import { consentedVersion } from "@/lib/consent";
import { isAppleConfigured, exchangeAppleCode, appleRedirectUri, appleDisplayName, isSafeNextPath } from "@/lib/oauth";
import { createDoctorAccount } from "@/lib/doctor-signup";
import { createPatientAccount } from "@/lib/patient-signup";

// POST /api/auth/apple/callback — Apple dönüşü. ⚠️ GET DEĞİL: `scope=name email` istendiğinde Apple
// `response_mode=form_post` zorunlu kılar, yani kod bize form gövdesiyle POST edilir (bkz. start rotası).
//
// Hesap eşlemesi ÜÇ kademeli ve sırası önemli:
//   1) appleSub  — kalıcı anahtar. Kullanıcı "E-postamı Gizle" seçtiyse e-posta değişebilir, sub değişmez.
//   2) e-posta   — sub eşleşmediyse: mevcut (e-posta/Google ile açılmış) hesabına ilk kez Apple bağlıyor.
//   3) yeni hesap — intent'e göre hasta/doktor.
// Silinmiş hesaplar her iki aramada da DIŞLANIR (appleSub silmede NULL'lanır, e-posta tombstone olur).
export async function POST(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const c = await cookies();
  const intent = c.get("a_oauth_intent")?.value === "patient" ? "patient" : "doctor";
  const savedState = c.get("a_oauth_state")?.value;
  const nonce = c.get("a_oauth_nonce")?.value;
  const next = c.get("a_oauth_next")?.value;
  c.delete("a_oauth_intent");
  c.delete("a_oauth_state");
  c.delete("a_oauth_nonce");
  c.delete("a_oauth_next");

  // ⚠️ 303 ŞART: bu bir POST handler'ı ve NextResponse.redirect varsayılanı 307'dir — 307 metodu
  // KORUR, yani tarayıcı hedef sayfaya da POST eder ve kullanıcı 405 görür. Google callback'inde
  // bu tuzak görünmez (oraya gelen istek zaten GET). Buradaki HER redirect 303 olmalı.
  const back = (reason: string) =>
    NextResponse.redirect(
      new URL(
        intent === "patient"
          ? `/giris?oauth=${reason}&provider=apple`
          : `/kayit?oauth=${reason}&provider=apple`,
        origin,
      ),
      303,
    );

  if (!isAppleConfigured()) return back("unavailable");

  const form = await req.formData().catch(() => null);
  if (!form) {
    console.error("[apple-auth] callback: form gövdesi okunamadı");
    return back("error");
  }
  const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

  // Kullanıcı Apple ekranında vazgeçerse hata da POST ile gelir (error=user_cancelled_authorize).
  if (str(form.get("error"))) return back("cancelled");

  const code = str(form.get("code"));
  const state = str(form.get("state"));
  if (!code || !state || !savedState || !nonce || state !== savedState) {
    // Hangi parçanın eksik olduğu teşhis için kritik: cookie'ler eksikse SameSite/tarayıcı
    // meselesi, form parçaları eksikse Apple dönüşü meselesi. Değerler LOGLANMAZ, yalnız varlık.
    console.error(
      `[apple-auth] callback: state doğrulaması düştü — code=${!!code} formState=${!!state} cookieState=${!!savedState} cookieNonce=${!!nonce} eşit=${!!state && state === savedState}`,
    );
    return back("error");
  }

  const identity = await exchangeAppleCode(code, appleRedirectUri(origin), nonce);
  if (!identity) return back("error"); // sebep exchangeAppleCode/verifyAppleIdToken içinde loglandı

  let user = await db.user.findFirst({ where: { appleSub: identity.sub, deletedAt: null } });
  if (!user) {
    const byEmail = await db.user.findUnique({ where: { email: identity.email } });
    if (byEmail && !byEmail.deletedAt) user = byEmail;
  }

  let newDoctor = false; // v6.87: yeni doktor önce /doktor/profil-tamamla'ya iner (bekçi zinciri)
  if (!user) {
    // Apple parola vermez; parola girişi devre dışı bırakılır (rastgele hash — Google deseni).
    const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
    // ⚠️ Ad YALNIZ ilk yetkilendirmede gelir; şimdi yakalanmazsa bir daha alınamaz.
    const name = appleDisplayName(str(form.get("user")) || null, identity);
    if (intent === "patient") {
      user = await createPatientAccount({ name, email: identity.email, passwordHash });
    } else {
      // Yeni doktor — branş/şehir/dil/telefon profil-tamamla ara sayfasında toplanır (v6.87;
      // /doktor/baslangic bekçisi de branch/city boşken oraya atar). verified:false (admin onayı bekler).
      user = await createDoctorAccount({
        name, email: identity.email, passwordHash,
        title: "Uzm. Dr.", branch: "", city: "", languages: "Türkçe",
      });
      newDoctor = true;
    }
  }

  // Apple bağını yaz + e-postayı doğrulanmış damgala (Apple email_verified'ı zaten şart koştuk —
  // verifyAppleIdToken kapısı). Zaten yazılıysa update'e hiç girmeyiz.
  if (user.appleSub !== identity.sub || !user.emailVerifiedAt) {
    try {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          appleSub: identity.sub,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          emailVerifyTokenHash: null,
        },
      });
    } catch {
      // appleSub unique: aynı Apple kimliği başka bir hesaba bağlıysa (nadir; hesap birleştirme
      // senaryosu) oturum açmaktansa akışı düşür — yanlış hesaba girmektense hata iyidir.
      return back("error");
    }
  }

  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role, cv });
  // Yeni doktor: kimlik ara sayfası (proxy onam kapısı next'i koruyarak önce /onam'a düşürür),
  // next varsa bile — kimlik eksikken hedef sayfaya düşürmek onboarding'i atlatırdı.
  const home = newDoctor
    ? "/doktor/profil-tamamla"
    : isSafeNextPath(next) ? next
    : user.role === "PATIENT" ? await patientHome(user.id) : roleHome(user.role as Role);
  return NextResponse.redirect(new URL(home, origin), 303); // POST → GET: 303 şart, 307 POST'u taşır
}

// Apple akışı POST döner; buraya GET ile gelinmesi (elle adres çubuğu, yanlış Return URL, tarayıcı
// geri tuşu) hata değil kayıp bir akıştır → sessizce forma dön, 500 üretme.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(new URL("/giris?oauth=error&provider=apple", origin));
}

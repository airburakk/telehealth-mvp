import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { brandRoleHome, type Role } from "@/lib/session";
import { patientHome } from "@/lib/patient-journey";
import { gateConsentVersion } from "@/lib/doctorium-consent";
import { isGoogleConfigured, exchangeGoogleCode, googleRedirectUri, isSafeNextPath } from "@/lib/oauth";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { createDoctorAccount } from "@/lib/doctor-signup";
import { createPatientAccount } from "@/lib/patient-signup";
import { reqMeta } from "@/lib/audit";
import { recordLogin } from "@/lib/login-activity";

// GET /api/auth/google/callback — Google dönüşü. State (CSRF) doğrula → kod takası → email/ad.
// Mevcut kullanıcı → giriş (mevcut rol; intent YOK SAYILIR — rol karışması olmaz). Yeni →
// intent=patient ise hasta hesabı, aksi halde doktor hesabı (kimlik onboarding'de tamamlanır).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const c = await cookies();
  const intent = c.get("g_oauth_intent")?.value === "patient" ? "patient" : "doctor";
  const next = c.get("g_oauth_next")?.value;
  c.delete("g_oauth_intent");
  c.delete("g_oauth_next");
  // ?oauth banner'ı kapı-içi formda çizilir (2026-08-06 — /e-posta alt rotası kaldırıldı).
  // Ayrışma (2026-08-24): Doctorium deploy'unda dönüş kapısı /doctorium/giris — /kayit burada
  // AURA'ya 307'lenir, banner hiç görünmezdi.
  const gate = intent === "patient" ? "/giris" : IS_DOCTORIUM_DEPLOY ? "/doctorium/giris" : "/kayit";
  const errBack = `${gate}?oauth=error&provider=google`;

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL(`${gate}?oauth=unavailable&provider=google`, origin));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = c.get("g_oauth_state")?.value;
  c.delete("g_oauth_state");
  if (!code || !state || !saved || state !== saved) {
    return NextResponse.redirect(new URL(errBack, origin));
  }

  const info = await exchangeGoogleCode(code, googleRedirectUri(origin));
  if (!info) return NextResponse.redirect(new URL(errBack, origin));

  let user = await db.user.findUnique({ where: { email: info.email } });
  let newDoctor = false; // v6.87: yeni doktor önce /doktor/profil-tamamla'ya iner (bekçi zinciri)
  if (!user) {
    // Google yalnız ad/e-posta verir; parola girişi devre dışı (rastgele hash).
    const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
    if (intent === "patient") {
      user = await createPatientAccount({ name: info.name, email: info.email, passwordHash });
    } else {
      // Yeni doktor — branş/şehir/dil/telefon profil-tamamla ara sayfasında toplanır (v6.87;
      // /doktor/baslangic bekçisi de branch/city boşken oraya atar). verified:false (admin onayı bekler).
      user = await createDoctorAccount({
        name: info.name, email: info.email, passwordHash,
        title: "Uzm. Dr.", branch: "", city: "", languages: "Türkçe",
      });
      newDoctor = true;
    }
  }
  // Google e-postayı zaten doğrular (exchangeGoogleCode email_verified şartı) → hesap doğrulanmış
  // damgalanır (v5.6). E-posta kaydıyla açılıp doğrulanmadan Google ile girene de geçerli: aynı
  // posta kutusunun sahibi olduğu Google'ca kanıtlandı; bekleyen token temizlenir.
  if (!user.emailVerifiedAt) {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null },
    });
  }

  // Ayrışma korkuluğu (2026-08-24): Doctorium deploy'unda HASTA hesabına oturum açılmaz —
  // patientHome rotaları burada AURA'ya 307'lenip kullanıcıyı sessizce marka değiştirtiyordu.
  if (IS_DOCTORIUM_DEPLOY && user.role === "PATIENT") {
    return NextResponse.redirect(new URL(`${gate}?oauth=role&provider=google`, origin));
  }

  const cv = await gateConsentVersion(user.id, user.role); // v6.211: rol/aşamaya göre gerekli onam seti
  const session = { id: user.id, email: user.email, name: user.name, role: user.role as Role, cv };
  await createSession(session);
  // Giriş etkinliği (v6.187) — "Hesabım"daki liste yöntemi de gösterir (parola | google | apple).
  const meta = reqMeta(req);
  await recordLogin(session, "google", meta.ip, meta.userAgent);
  // Faz 5: dönen hasta vaka merkezine iner (başvurusu yoksa /triyaj). Yeni doktor: kimlik ara
  // sayfası (proxy onam kapısı next'i koruyarak önce /onam'a düşürür — zincir bozulmaz). Yeni
  // doktor DAİMA profil-tamamla'ya iner (next varsa bile) — kimlik eksikken hedef sayfaya
  // düşürmek onboarding'i atlatırdı; next mevcut kullanıcı için geçerli.
  const home = newDoctor
    ? "/doktor/profil-tamamla"
    : isSafeNextPath(next) ? next
    : user.role === "PATIENT" ? await patientHome(user.id) : brandRoleHome(user.role as Role);
  return NextResponse.redirect(new URL(home, origin));
}

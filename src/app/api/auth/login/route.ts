import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPassword, createSession } from "@/lib/auth";
import { brandRoleHome, type Role } from "@/lib/session";
import { patientHome } from "@/lib/patient-journey";
import { gateConsentVersion } from "@/lib/doctorium-consent";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isEmailConfigured } from "@/lib/email";
import { sendAlert } from "@/lib/alerts";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { reqMeta } from "@/lib/audit";
import { recordLogin } from "@/lib/login-activity";

// Sabit-zaman 401 (denetim #21): kullanıcı YOKKEN de aynı maliyette bcrypt koşturulur — yanıt süresi
// e-postanın kayıtlı olup olmadığını sızdırmasın (hesap enumerasyonu; resend-verification'ın jenerik
// yanıt disipliniyle simetri). Geçerli cost-10 hash: karşılaştırma tam bcrypt turu yapar, asla eşleşmez.
const DUMMY_HASH = "$2b$10$9hE/6LArtUdLP81/s1gXx.MQgKk0552oxDw6J7s4DFLWgBAxxOGVW";

export async function POST(req: Request) {
  const rl = await rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000); // brute-force freni: 10/5dk/IP
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");

  const user = await db.user.findUnique({ where: { email } });
  if (!(await checkPassword(password, user?.passwordHash ?? DUMMY_HASH)) || !user) {
    return NextResponse.json({ error: "E-posta veya parola hatalı." }, { status: 401 });
  }

  // E-posta doğrulama kapısı (v5.6): doğrulanmamış yeni kayıtlarda uygulanır (mevcut hesaplar
  // migration'da damgalandı). UI, code ile "yeniden gönder" sunar.
  //
  // ÜRETİMDE ZORUNLU (2026-08-03, kullanıcı kararı — dış denetim bulgusu): eski hâli
  // `isEmailConfigured() && …` idi, yani sağlayıcı anahtarı kaldırılırsa kapı da kalkıyordu
  // (fail-open) → doğrulanmamış hesaplar giriş yapabilirdi. Artık üretimde kapı her hâlükârda
  // AÇIK; yapılandırma eksikse bu bir yapılandırma HATASIDIR ve alarm üretir (kullanıcılar
  // "doğrulama e-postası gelmiyor" diye kilitlenmesin diye sessiz kalınmaz).
  // Geliştirmede davranış aynen korunur: e-posta yapılandırılmamışsa kapı kapalı kalır.
  const emailGateActive = isEmailConfigured() || process.env.NODE_ENV === "production";
  if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
    void sendAlert(
      "email-provider-missing",
      "Üretimde e-posta sağlayıcısı yapılandırılmamış — doğrulama e-postası gönderilemiyor, giriş kapısı kapalı (SEV-2)",
      "login",
    );
  }
  if (emailGateActive && !user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu (ve spam klasörünü) kontrol edin.", code: "EMAIL_UNVERIFIED" },
      { status: 403 },
    );
  }

  // Ayrışma (2026-08-24, kullanıcı bulgusu "Apple girişi AURA'ya attı" ailesi): Doctorium
  // deploy'unda HASTA hesabı oturum açamaz — hasta rotaları burada AURA'ya 307'lendiğinden
  // kullanıcı sessizce başka markaya savruluyordu. Oturum YAZILMAZ, net mesaj döner.
  if (IS_DOCTORIUM_DEPLOY && user.role === "PATIENT") {
    return NextResponse.json(
      { error: "Bu hesap bir hasta hesabı. Doctorium, doktor ve tıp öğrencilerine özel bir çalışma alanıdır — hasta girişi için AURA'yı kullanın." },
      { status: 403 },
    );
  }

  // KVKK onam sürümünü oturuma göm → proxy DB'siz kontrol eder; onam yoksa /onam'a yönlenir.
  // v6.211: rol/aşamaya göre GEREKLİ set (DOCTOR → Doctorium seti; hasta/personel → GENERAL) — lib/doctorium-consent.
  const cv = await gateConsentVersion(user.id, user.role);
  const session = { id: user.id, email: user.email, name: user.name, role: user.role as Role, cv };
  await createSession(session);
  // Giriş etkinliği (v6.187): "Hesabım → Giriş etkinliği" listesinin kaynağı. Oturum çerezi
  // YAZILDIKTAN SONRA — başarısız denemeler bu listeye düşmez. recordAccess fail-safe olduğu için
  // await edilmesi girişi riske atmaz.
  const meta = reqMeta(req);
  await recordLogin(session, "parola", meta.ip, meta.userAgent);
  // Faz 5: dönen hasta vaka merkezine iner (başvurusu yoksa /triyaj); diğer roller statik.
  // Kurumsal üyelik (2026-08-12): doğrulanmamış PARTNER/AGENCY/HEALTH_PRO başvuru durumuna iner
  // (rol sayfaları da kendi kapısında aynı yöne düşürür — yönlendirme ≠ güvenlik).
  const staffPending =
    ["PARTNER", "AGENCY", "HEALTH_PRO"].includes(user.role) && !user.staffVerifiedAt;
  const home =
    user.role === "PATIENT" ? await patientHome(user.id)
    : staffPending ? "/kayit/durum"
    : brandRoleHome(user.role as Role);
  return NextResponse.json({ ok: true, role: user.role, home });
}

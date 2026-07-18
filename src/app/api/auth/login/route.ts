import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPassword, createSession } from "@/lib/auth";
import { roleHome, type Role } from "@/lib/session";
import { patientHome } from "@/lib/patient-journey";
import { consentedVersion } from "@/lib/consent";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isEmailConfigured } from "@/lib/email";

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

  // E-posta doğrulama kapısı (v5.6): yalnız e-posta yapılandırılmışken ve YALNIZ doğrulanmamış
  // yeni kayıtlarda (mevcut hesaplar migration'da damgalandı). Env kaldırılırsa kapı da kalkar
  // (fail-open — sağlayıcı kesintisi kimseyi kilitlemesin). UI code ile "yeniden gönder" sunar.
  if (isEmailConfigured() && !user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu (ve spam klasörünü) kontrol edin.", code: "EMAIL_UNVERIFIED" },
      { status: 403 },
    );
  }

  // KVKK onam sürümünü oturuma göm → proxy DB'siz kontrol eder; onam yoksa /onam'a yönlenir.
  const cv = await consentedVersion(user.id);
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role, cv });
  // Faz 5: dönen hasta vaka merkezine iner (başvurusu yoksa /triyaj); diğer roller statik
  const home = user.role === "PATIENT" ? await patientHome(user.id) : roleHome(user.role as Role);
  return NextResponse.json({ ok: true, role: user.role, home });
}

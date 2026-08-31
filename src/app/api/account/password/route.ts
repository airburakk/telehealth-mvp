// POST /api/account/password — parolayı değiştir veya (OAuth hesabında) ilk kez belirle.
// body: { current?: string, next: string }
//
// İKİ MOD, TEK UÇ — ayrımı User.passwordSetAt yapar (v6.187):
//   · passwordSetAt DOLU  → kullanıcının bildiği bir parola var → `current` ZORUNLU ve doğrulanır.
//   · passwordSetAt NULL  → hesap Google/Apple ile açılmış, passwordHash rastgele gölge hash → o
//     parolayı kimse bilmiyor, sormak anlamsız. `current` istenmez; kullanıcı parolasını belirler.
//     Google/Apple girişi çalışmaya DEVAM eder (sağlayıcı bağı koparılmaz).
//
// ⚠️ NEDEN OTURUM SAHİPLİĞİ YETERLİ (parola belirlemede e-posta turu yok): hesap zaten bu tarayıcıda
// açık ve OAuth sağlayıcısı e-postayı doğrulamış (emailVerifiedAt). Oturumu ele geçiren biri hesabı
// halihazırda kullanabiliyor; parola eklemek ona YENİ bir yetki vermez. Buna karşılık işlem
// (a) dolaşımdaki TÜM oturumları düşürür ve (b) hesap sahibine bilgilendirme e-postası gider —
// gerçek sahip durumu fark eder ve kendi girişiyle parolayı yeniden alır.
//
// 🔴 PAROLA AUDIT'E YAZILMAZ. Zincire yalnız "değişti" olgusu ve mod bilgisi düşer (lib/alerts
// asla-loglama kuralı).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";
import { checkPassword, hashPassword, createSession, revokeUserSessions } from "@/lib/auth";
import { recordAccess, reqMeta } from "@/lib/audit";
import { HOUR_MS, rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import type { Role } from "@/lib/session";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 8; // signup rotalarıyla aynı politika

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  // Deneme freni: `current` doğrulaması bir parola oracle'ıdır (oturum çalınmış senaryosunda
  // saldırgan mevcut parolayı buradan brute-force edebilirdi).
  const limited = await rateLimit(`password-change:${user.id}`, 5, HOUR_MS);
  if (!limited.ok) {
    return NextResponse.json({ error: "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin." }, { status: 429 });
  }

  // Bürünme (master) oturumunda parola değiştirilemez — kullanıcı adına kalıcı erişim üretilemez.
  if (user.imp) {
    return NextResponse.json({ error: "Bürünme oturumunda parola değiştirilemez." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const current = String(b?.current ?? "");
  const next = String(b?.next ?? "");

  if (next.length < MIN_LENGTH) {
    return NextResponse.json({ error: `Parola en az ${MIN_LENGTH} karakter olmalı.` }, { status: 400 });
  }

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, passwordHash: true, passwordSetAt: true },
  });
  if (!row) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

  const isChange = row.passwordSetAt !== null;
  if (isChange) {
    if (!current) {
      return NextResponse.json({ error: "Mevcut parolanızı girin." }, { status: 400 });
    }
    if (!(await checkPassword(current, row.passwordHash))) {
      return NextResponse.json({ error: "Mevcut parolanız hatalı." }, { status: 400 });
    }
    if (current === next) {
      return NextResponse.json({ error: "Yeni parola mevcut parolanızla aynı olamaz." }, { status: 400 });
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), passwordSetAt: new Date() },
  });

  // İPTAL ÖNCE, TAZE OTURUM SONRA. revokeUserSessions sessionVersion'ı artırır → dolaşımdaki tüm
  // token'lar (diğer cihazlar) bayatlar; createSession sv'yi DB'den TAZE okuyup bu cihaza yeni token
  // yazar, böylece işlemi yapan kullanıcı kendi kendini dışarı atmaz. Sıra ters olsaydı bu cihazın
  // taze token'ı da bump'la birlikte bayatlardı.
  await revokeUserSessions(user.id);
  await createSession({ id: row.id, email: row.email, name: row.name, role: row.role as Role, cv: user.cv });

  const meta = reqMeta(req);
  await recordAccess({
    actor: user,
    action: "PASSWORD_CHANGE",
    resourceType: "User",
    resourceId: user.id,
    subjectUserId: user.id,
    detail: isChange ? "parola değiştirildi; tüm oturumlar düşürüldü" : "ilk parola belirlendi (OAuth hesabı); tüm oturumlar düşürüldü",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  // Bilgilendirme — fire-safe (gönderim patlarsa işlem geri alınmaz; Resend dormant'ken simüle edilir).
  void sendEmail({
    to: row.email,
    subject: isChange ? "Parolanız değiştirildi" : "Hesabınıza parola eklendi",
    text:
      `Merhaba ${row.name},\n\n` +
      (isChange
        ? "Hesabınızın parolası az önce değiştirildi.\n"
        : "Hesabınıza az önce bir parola eklendi. Google/Apple ile girişiniz çalışmaya devam ediyor.\n") +
      "Güvenlik gereği tüm cihazlardaki oturumlarınız kapatıldı.\n\n" +
      "Bu işlemi siz yapmadıysanız derhâl parolanızı sıfırlayın ve bizimle iletişime geçin.",
  }).catch(() => {});

  return NextResponse.json({ ok: true, mode: isChange ? "changed" : "set" });
}

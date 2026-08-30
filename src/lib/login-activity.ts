// Giriş etkinliği (v6.187 — Doctorium "Hesabım").
//
// 🔴 NE OLMADIĞI ÖNEMLİ: bu modül "açık oturumlar" listesi ÜRETMEZ ve üretemez. Oturum bu sistemde
// bir DB satırı değil, JWT içindeki `sv` claim'idir (lib/auth); iptal tek bir sayaçla toptan yapılır
// (User.sessionVersion++ → dolaşımdaki tüm token'lar bayatlar). Sunucu kaç oturumun açık olduğunu
// BİLMEZ. Dolayısıyla kullanıcıya gösterilen şey giriş KAYITLARIDIR ve arayüz de bunu aynen böyle
// söyler — "şu cihazlarda açıksınız" demek, elimizde olmayan bir veriyi varmış gibi göstermek olurdu
// (vitrin iddia dürüstlüğü disiplininin iç yüzeydeki karşılığı).
//
// Kayıt AccessLog'a düşer (append-only hash zinciri): ayrı tablo açmak yerine mevcut denetim zinciri
// kullanılır — giriş zaten denetlenmesi gereken bir olaydır ve zincir ip/userAgent alanlarını
// halihazırda taşır. recordAccess FAIL-SAFE'tir: audit yazımı patlarsa giriş akışı etkilenmez.
import { db } from "./db";
import { recordAccess } from "./audit";
import type { SessionUser } from "./session";

export type LoginMethod = "parola" | "google" | "apple";

/**
 * Girişi zincire yaz. Çağıran YERİ önemli: oturum çerezi yazıldıktan SONRA çağrılmalı ki başarısız
 * denemeler listeye düşmesin (başarısız giriş bu listenin konusu değil; rate-limit onu ayrı tutar).
 *
 * ⚠️ `void` ile çağrılabilir — girişin yanıtını bekletmeye değmez.
 */
export async function recordLogin(
  user: SessionUser,
  method: LoginMethod,
  ip?: string | null,
  userAgent?: string | null,
): Promise<void> {
  await recordAccess({
    actor: user,
    action: "LOGIN",
    resourceType: "User",
    resourceId: user.id,
    subjectUserId: user.id,
    detail: method,
    ip,
    userAgent,
  });
}

export type LoginEvent = {
  id: string;
  at: Date;
  ip: string | null;
  device: string;
  method: LoginMethod | string;
};

/** Son N giriş kaydı (yeni→eski). Yalnız kullanıcının KENDİ kayıtları — çağıran oturumdan türetir. */
export async function recentLogins(userId: string, limit = 10): Promise<LoginEvent[]> {
  const rows = await db.accessLog.findMany({
    where: { actorId: userId, action: "LOGIN" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], // tek alanlı orderBy deterministik değil
    take: limit,
    select: { id: true, createdAt: true, ip: true, userAgent: true, detail: true },
  });
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt,
    ip: r.ip,
    device: describeUserAgent(r.userAgent),
    method: r.detail ?? "parola",
  }));
}

// ── User-Agent → okunabilir cihaz etiketi ────────────────────────────────────────────────────────
// Dış paket YOK (bundle + tedarik yüzeyi): kaba ama yeterli bir eşleme. Amaç kesin cihaz tespiti
// değil, kullanıcının "bu ben miydim?" sorusuna cevap verebilmesi. Tanınmayan UA ham bırakılmaz
// (uzun ve okunmaz) — "Bilinmeyen tarayıcı" denir.
//
// ⚠️ SIRA ÖNEMLİ: Edge UA'sı "Chrome" da içerir, Chrome UA'sı "Safari" de içerir → daha spesifik
// olan önce denenmeli. Aynı şekilde iPadOS "Macintosh" gibi görünebilir; iPad ipucu önce aranır.
const BROWSERS: [RegExp, string][] = [
  [/\bEdg[A-Z]?\//, "Edge"],
  [/\bOPR\/|\bOpera\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\//, "Chrome"],
  // 🪤 `\b` YOK (bilinçli): "HeadlessChrome/…" içinde Chrome'dan önce harf var, word-boundary
  // eşleşmez ve UA sonraki kurala (Safari — Chromium UA'sı "Safari/537.36" içerir) düşerdi.
  // Canlıda ölçüldü: Playwright girişi "Safari · Windows" olarak kaydedilmişti.
  [/Chrome\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

const PLATFORMS: [RegExp, string][] = [
  [/\biPad\b/, "iPad"],
  [/\biPhone\b/, "iPhone"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows NT\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "Mac"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
];

function match(ua: string, table: [RegExp, string][]): string | null {
  for (const [re, label] of table) if (re.test(ua)) return label;
  return null;
}

export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Bilinmeyen tarayıcı";
  const browser = match(ua, BROWSERS);
  const platform = match(ua, PLATFORMS);
  if (browser && platform) return `${browser} · ${platform}`;
  return browser ?? platform ?? "Bilinmeyen tarayıcı";
}

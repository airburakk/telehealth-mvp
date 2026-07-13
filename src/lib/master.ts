// MASTER hesabı (impersonation) — MVP boyunca aktif, env-gated + e-posta allowlist + audit'li.
// Yetki E-POSTA'ya kilitli (role DEĞİL): yalnız MASTER_ACCOUNT_EMAILS listesindeki kullanıcı,
// MASTER_ACCOUNT_ENABLED açıkken master olabilir. Kapalıysa /master + impersonate uçları erişilemez
// (fail-closed). Bürünme sırasında kimlik = bürünülen kullanıcı → o oturum master SAYILMAZ (iç içe
// bürünme imkânsız). Gerçek master kimliği yalnız SessionUser.imp'te (geri dönüş + banner + audit).

import type { SessionUser } from "./session";

export function isMasterEnabled(): boolean {
  return process.env.MASTER_ACCOUNT_ENABLED === "true";
}

// Virgülle ayrılmış allowlist → normalize (küçük harf, trim).
export function masterEmails(): string[] {
  return (process.env.MASTER_ACCOUNT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isMasterEmail(email?: string | null): boolean {
  if (!email) return false;
  return masterEmails().includes(email.trim().toLowerCase());
}

// Kullanıcı (bürünmemiş) master mı? enabled + allowlist + imp yok. Header/nav/layout görünürlüğü bununla.
// ⚠️ Bu modül SAF tutulur (NextResponse/next-server import ETMEZ) → server component'ler (root layout,
// /master sayfası) güvenle import eder. API kapısı `requireMaster` ayrı dosyada (lib/master-guard.ts):
// next/server'ı bir server component'e sızdırmak prod'da runtime hatası verir ([[master-account-impersonation]]).
export function isMaster(user?: SessionUser | null): boolean {
  return isMasterEnabled() && !!user && !user.imp && isMasterEmail(user.email);
}

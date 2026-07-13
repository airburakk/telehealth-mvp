// MASTER hesabı (impersonation) — MVP boyunca aktif, env-gated + e-posta allowlist + audit'li.
// Yetki E-POSTA'ya kilitli (role DEĞİL): yalnız MASTER_ACCOUNT_EMAILS listesindeki kullanıcı,
// MASTER_ACCOUNT_ENABLED açıkken master olabilir. Kapalıysa /master + impersonate uçları erişilemez
// (fail-closed). Bürünme sırasında kimlik = bürünülen kullanıcı → o oturum master SAYILMAZ (iç içe
// bürünme imkânsız). Gerçek master kimliği yalnız SessionUser.imp'te (geri dönüş + banner + audit).

import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
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

// Kullanıcı (bürünmemiş) master mı? enabled + allowlist + imp yok. Header/nav görünürlüğü bununla.
export function isMaster(user?: SessionUser | null): boolean {
  return isMasterEnabled() && !!user && !user.imp && isMasterEmail(user.email);
}

type Ok = { user: SessionUser; error: null };
type Err = { user: null; error: NextResponse };

// API/sayfa kapısı: yalnız (bürünmemiş) master geçer. Enabled değilse 404 (özelliğin varlığını
// sızdırmamak için); oturum yoksa 401; master değilse / bürünme oturumundaysa 403.
export async function requireMaster(): Promise<Ok | Err> {
  if (!isMasterEnabled()) {
    return { user: null, error: NextResponse.json({ error: "Bulunamadı." }, { status: 404 }) };
  }
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }) };
  if (user.imp || !isMasterEmail(user.email)) {
    return { user: null, error: NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 }) };
  }
  return { user, error: null };
}

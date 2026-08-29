// Oturum token mantığı — edge-güvenli (yalnız jose, next/headers YOK)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "air_session";

// Rol sabitleri lib/roles.ts'e taşındı (2026-07-31): SIRSIZ oldukları için client bileşenleri de
// kullanabilsin. Buradan yeniden dışa verilir → mevcut sunucu-tarafı importlar (`@/lib/session`)
// aynen çalışır. ⚠️ "use client" bir dosyadan ASLA bu modülü import etme; `@/lib/roles` kullan
// (bu dosya modül yüklenirken SESSION_SECRET doğrular ve üretimde THROW eder).
export { ROLES, isRole, ROLE_LABELS, roleHome, brandRoleHome, type Role } from "./roles";
import type { Role } from "./roles";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  cv?: number; // onaylanan KVKK onam sürümü (consented version); 0/undefined = onam yok
  sv?: number; // oturum sürümü (session version) — User.sessionVersion snapshot'ı; uyuşmazsa token iptal (JWT revocation)
  imp?: string; // MASTER impersonation: bu oturum bir master tarafından başlatıldıysa gerçek master'ın User.id'si
                // (kimlik = bürünülen kullanıcı; imp yalnız "master'a dön" + banner + audit izi için taşınır)
  staffVerified?: boolean; // kurumsal üyelik onayı (2026-08-12) — TOKEN'DA TAŞINMAZ; getCurrentUser her
                           // istekte DB'den doldurur (User.staffVerifiedAt snapshot'ı). PARTNER/AGENCY/
                           // HEALTH_PRO kapıları buna bakar (doğrulanmamış → /kayit/durum, API 403).
}

// Oturum imzalama anahtarı (T4). ÜRETİMDE eksik/zayıf/varsayılan ise BOOT DURUR (forge edilebilir
// JWT'yi engeller). Dev'de değer yoksa fallback + yüksek sesli uyarı (çalışan dev'i kırmaz).
// ⚠️ Deploy ön-koşulu: Vercel'de güçlü SESSION_SECRET set olmalı (openssl rand -base64 32), yoksa
// üretim boot'ta çöker — bu kasıtlı.
const WEAK_SECRETS = new Set(["air-mvp-dev-secret", "change-me-to-a-long-random-secret"]);
function resolveSessionSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  const weak = !s || WEAK_SECRETS.has(s) || s.length < 16;
  if (weak) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET üretimde zorunlu ve güçlü olmalı (eksik/varsayılan/<16 karakter) — boot durduruldu. " +
        "Vercel ortam değişkenine `openssl rand -base64 32` çıktısı atayın."
      );
    }
    console.warn(
      "⚠️ SESSION_SECRET eksik/zayıf — yalnız DEV fallback kullanılıyor (forge edilebilir). " +
      "ÜRETİMDE boot durur. .env'e güçlü bir SESSION_SECRET ekleyin."
    );
    return new TextEncoder().encode("air-mvp-dev-secret");
  }
  return new TextEncoder().encode(s);
}
// LAZY: modül yüklenirken DEĞİL, ilk imzalama/doğrulamada çözülür. Koruma birebir aynı (üretimde
// zayıf sır → ilk oturum işleminde THROW), ama modülün yanlışlıkla client'a sızması sayfayı
// çökertmez — savunma derinliği (2026-07-31 master paneli olayı).
let _secret: Uint8Array | null = null;
function secretKey(): Uint8Array {
  if (!_secret) _secret = resolveSessionSecret();
  return _secret;
}

export async function signToken(user: SessionUser): Promise<string> {
  const claims: Record<string, unknown> = { email: user.email, name: user.name, role: user.role, cv: user.cv ?? 0, sv: user.sv ?? 0 };
  if (user.imp) claims.imp = user.imp; // yalnız bürünme oturumunda taşınır
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      cv: Number(payload.cv ?? 0),
      sv: Number(payload.sv ?? 0), // eski (sv'siz) token → 0 = DB default'u → canlı oturumlar bozulmaz
      imp: payload.imp ? String(payload.imp) : undefined, // master impersonation izi (varsa)
    };
  } catch {
    return null;
  }
}

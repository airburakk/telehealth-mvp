// Oturum token mantığı — edge-güvenli (yalnız jose, next/headers YOK)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "air_session";

export type Role = "PATIENT" | "DOCTOR" | "COORDINATOR" | "ETHICS" | "ADMIN" | "PARTNER" | "AGENCY";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  cv?: number; // onaylanan KVKK onam sürümü (consented version); 0/undefined = onam yok
  sv?: number; // oturum sürümü (session version) — User.sessionVersion snapshot'ı; uyuşmazsa token iptal (JWT revocation)
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
const secret = resolveSessionSecret();

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role, cv: user.cv ?? 0, sv: user.sv ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      cv: Number(payload.cv ?? 0),
      sv: Number(payload.sv ?? 0), // eski (sv'siz) token → 0 = DB default'u → canlı oturumlar bozulmaz
    };
  } catch {
    return null;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
  AGENCY: "Sağlık Turizmi Acentesi",
};

export function roleHome(role: Role): string {
  if (role === "COORDINATOR") return "/operasyon"; // S2 operasyon paneli
  if (role === "DOCTOR") return "/doktor";
  if (role === "ETHICS") return "/etik-kurul";
  if (role === "PARTNER") return "/partner"; // M5 Faz 3 — Partner Doktor alanı
  if (role === "AGENCY") return "/acente"; // S3 Sağlık Turizmi Acentesi — tedavi dosyaları kuyruğu (FAZ 4)
  if (role === "PATIENT") return "/triyaj"; // hasta: doğrudan Branş Doktoru akışı (/basla 4'lü seçimi kaldırıldı 2026-07-12; diğer kulvarlar kendi sayfalarından)
  return "/vakalarim"; // ADMIN vb.
}

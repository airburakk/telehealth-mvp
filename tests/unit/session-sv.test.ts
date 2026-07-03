// JWT iptali (sv claim) — session.ts saf token mantığı (DB'siz).
// Kritik geriye-uyumluluk kuralı: sv'siz eski token → sv=0 (DB default'u) → canlı oturumlar düşmez.
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { signToken, verifyToken } from "@/lib/session";

const USER = { id: "u1", email: "a@b.c", name: "Test", role: "PATIENT" as const };
// session.ts dev fallback sırrı (SESSION_SECRET set değilken) — testte aynı anahtarla imzalarız
const DEV_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || "air-mvp-dev-secret");

describe("session sv claim (JWT iptali)", () => {
  it("sv imzalanır ve round-trip korunur", async () => {
    const token = await signToken({ ...USER, sv: 3 });
    const out = await verifyToken(token);
    expect(out?.sv).toBe(3);
  });

  it("sv verilmezse 0 imzalanır", async () => {
    const token = await signToken({ ...USER });
    const out = await verifyToken(token);
    expect(out?.sv).toBe(0);
  });

  it("ESKİ (sv claim'siz) token → sv=0 kabul edilir (toplu-logout kazası olmaz)", async () => {
    // v4.16 öncesi üretilmiş token'ı simüle et: payload'da sv alanı hiç yok
    const legacy = await new SignJWT({ email: USER.email, name: USER.name, role: USER.role, cv: 2 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER.id)
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(DEV_SECRET);
    const out = await verifyToken(legacy);
    expect(out).not.toBeNull();
    expect(out?.sv).toBe(0);
  });

  it("cv claim'i sv eklenince de korunur (onam kapısı regresyonu yok)", async () => {
    const token = await signToken({ ...USER, cv: 2, sv: 1 });
    const out = await verifyToken(token);
    expect(out?.cv).toBe(2);
    expect(out?.sv).toBe(1);
  });
});

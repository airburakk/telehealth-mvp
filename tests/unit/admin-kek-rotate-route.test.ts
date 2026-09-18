// Birim testleri — POST /api/admin/kek-rotate (break-glass KEK rotasyonu, 2026-09-18, tatbikat #1 A1).
// Sözleşme: KEK_ROTATION_SECRET yokken 404 ve oturuma bile bakılmaz · yalnız ADMIN (bürünme yasak) · gövdedeki
// gizli değer sabit-zamanlı doğrulanır, yanlışsa audit KEK_ROTATION_DENIED + alarm · yeni KEK 32B base64 ve
// mevcut anahtardan farklı · dry-run varsayılan, APPLY onay ifadesi ister · motor 700 sn bütçeyle çağrılır ·
// audit/alarm/yanıt hiçbir yerde anahtarın kendisini taşımaz (yalnız sha256 önekleri) · doctorium deploy'unda 404.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/alerts", () => ({ sendAlert: vi.fn(async () => ({ logged: true, emailed: false, suppressed: null })) }));
vi.mock("@/lib/audit", () => ({
  recordAccess: vi.fn(async () => {}),
  reqMeta: () => ({ ip: null, userAgent: null }),
}));
vi.mock("@/lib/db", () => ({ db: { $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn() } }));
vi.mock("@/lib/kek-rotation", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/kek-rotation")>();
  return { ...real, rotateKek: vi.fn() };
});

import { POST } from "@/app/api/admin/kek-rotate/route";
import { getCurrentUser } from "@/lib/auth";
import { sendAlert } from "@/lib/alerts";
import { recordAccess } from "@/lib/audit";
import { rotateKek, shortFingerprint, CONFIRM_PHRASE, type RotateKekResult } from "@/lib/kek-rotation";
import type { SessionUser } from "@/lib/session";

const OLD_B64 = randomBytes(32).toString("base64");
const NEW_B64 = randomBytes(32).toString("base64");
const SECRET = "break-glass-" + randomBytes(8).toString("hex");

const user = (role: string, extra: Partial<SessionUser> = {}) =>
  ({ id: "u-admin", role, email: "yonetici@example.test", name: "Y", ...extra } as SessionUser);

const mkReq = (body: unknown) =>
  new Request("http://localhost/api/admin/kek-rotate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

const okResult = (over: Partial<RotateKekResult> = {}): RotateKekResult => ({
  mode: "dry-run", blobs: true, scanned: { tables: 58, columns: 464 }, columns: [],
  totals: { rewrap: 3, already: 0, foreign: 0, blob: 1, blobRotated: 0 },
  foreignSamples: [], unrotatable: [], complete: true, durationMs: 1234, ...over,
});

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(sendAlert).mockClear();
  vi.mocked(recordAccess).mockClear();
  vi.mocked(rotateKek).mockReset();
  vi.stubEnv("KEK_ROTATION_SECRET", SECRET);
  vi.stubEnv("DATA_ENCRYPTION_KEK", OLD_B64);
  vi.stubEnv("BRAND_MODE", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/admin/kek-rotate — kapı", () => {
  it("KEK_ROTATION_SECRET yokken 404: uç uykuda, oturuma bile bakılmaz", async () => {
    vi.stubEnv("KEK_ROTATION_SECRET", "");
    const res = await POST(mkReq({ secret: "x", newKek: NEW_B64 }));
    expect(res.status).toBe(404);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(rotateKek).not.toHaveBeenCalled();
  });

  it("oturum yoksa 401; ADMIN dışı ve bürünme oturumu 403", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await POST(mkReq({ secret: SECRET, newKek: NEW_B64 }))).status).toBe(401);
    for (const role of ["DOCTOR", "COORDINATOR", "ETHICS", "PATIENT"]) {
      vi.mocked(getCurrentUser).mockResolvedValue(user(role));
      expect((await POST(mkReq({ secret: SECRET, newKek: NEW_B64 }))).status).toBe(403);
    }
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN", { imp: "master-1" }));
    expect((await POST(mkReq({ secret: SECRET, newKek: NEW_B64 }))).status).toBe(403);
    expect(rotateKek).not.toHaveBeenCalled();
    expect(recordAccess).not.toHaveBeenCalled();
  });

  it("yanlış ikinci faktör: 403 + audit KEK_ROTATION_DENIED + alarm; motor çağrılmaz", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    const res = await POST(mkReq({ secret: SECRET + "x", newKek: NEW_B64 }));
    expect(res.status).toBe(403);
    expect(rotateKek).not.toHaveBeenCalled();
    expect(recordAccess).toHaveBeenCalledWith(expect.objectContaining({ action: "KEK_ROTATION_DENIED", resourceType: "kek" }));
    expect(sendAlert).toHaveBeenCalledWith("kek-rotation-denied", expect.any(String), "actor=u-admin");
    // eksik/yanlış tipte secret de aynı yol
    expect((await POST(mkReq({ newKek: NEW_B64 }))).status).toBe(403);
  });

  it("geçersiz gövde 400; yeni KEK eksik/kısa 400; mevcut anahtarla aynı 400; env KEK yoksa 503", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    const bad = new Request("http://localhost/api/admin/kek-rotate", { method: "POST", body: "{düz" });
    expect((await POST(bad)).status).toBe(400);
    expect((await POST(mkReq({ secret: SECRET }))).status).toBe(400);
    expect((await POST(mkReq({ secret: SECRET, newKek: "kisa" }))).status).toBe(400);
    expect((await POST(mkReq({ secret: SECRET, newKek: OLD_B64 }))).status).toBe(400);
    vi.stubEnv("DATA_ENCRYPTION_KEK", "");
    expect((await POST(mkReq({ secret: SECRET, newKek: NEW_B64 }))).status).toBe(503);
    expect(rotateKek).not.toHaveBeenCalled();
  });

  it("APPLY onay ifadesi olmadan 400 — motor çağrılmaz", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    const res = await POST(mkReq({ secret: SECRET, newKek: NEW_B64, mode: "apply", confirm: "rotasyon" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(CONFIRM_PHRASE);
    expect(rotateKek).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/kek-rotate — koşum", () => {
  it("dry-run varsayılan: motor apply=false, blobs=true, 700 sn bütçeyle; audit KEK_ROTATION; alarm YOK; anahtar hiçbir yerde", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    vi.mocked(rotateKek).mockResolvedValue(okResult());
    const before = Date.now();
    const res = await POST(mkReq({ secret: SECRET, newKek: ` ${NEW_B64}\n` }));
    expect(res.status).toBe(200);
    const opts = vi.mocked(rotateKek).mock.calls[0][0];
    expect(opts.apply).toBe(false);
    expect(opts.blobs).toBe(true);
    expect(opts.deadline).toBeGreaterThanOrEqual(before + 700_000);
    expect(opts.deadline).toBeLessThan(before + 700_000 + 10_000);
    expect(opts.tables).toBeUndefined(); // break-glass ucu kısmi tarama yapmaz
    expect(opts.newKek.toString("base64")).toBe(NEW_B64); // kırpılmış gövde değeri

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("dry-run");
    expect(body.oldFingerprint).toBe(shortFingerprint(OLD_B64));
    expect(body.newFingerprint).toBe(shortFingerprint(NEW_B64));
    expect(body.newFingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(body.nextSteps.join(" ")).toMatch(/escrow/i);
    const text = JSON.stringify(body);
    expect(text).not.toContain(NEW_B64);
    expect(text).not.toContain(OLD_B64);

    expect(recordAccess).toHaveBeenCalledTimes(1);
    const audit = vi.mocked(recordAccess).mock.calls[0][0];
    expect(audit.action).toBe("KEK_ROTATION");
    expect(audit.resourceId).toBe(shortFingerprint(NEW_B64));
    expect(audit.detail).toContain("mode=dry-run");
    expect(audit.detail).toContain("rewrap=3");
    expect(audit.detail).not.toContain(NEW_B64);
    expect(audit.detail).not.toContain(OLD_B64);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it("apply + onay ifadesi: motor apply=true; alarm 'kek-rotation'; sonraki adımlar İKİ projeyi ve ikinci turu söyler", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    vi.mocked(rotateKek).mockResolvedValue(okResult({ mode: "apply", totals: { rewrap: 3, already: 0, foreign: 0, blob: 1, blobRotated: 1 } }));
    const res = await POST(mkReq({ secret: SECRET, newKek: NEW_B64, mode: "apply", confirm: CONFIRM_PHRASE, blobs: true }));
    expect(res.status).toBe(200);
    expect(vi.mocked(rotateKek).mock.calls[0][0].apply).toBe(true);
    const body = await res.json();
    const steps: string = body.nextSteps.join("\n");
    expect(steps).toMatch(/İKİ projede/);
    expect(steps).toMatch(/bir kez daha/);
    expect(steps).toMatch(/İMHA ETMEYİN/);
    expect(steps).toMatch(/KEK_ROTATION_SECRET/);
    expect(sendAlert).toHaveBeenCalledWith("kek-rotation", expect.stringMatching(/UYGULANDI/), expect.stringContaining("mode=apply"));
    expect(JSON.stringify(body)).not.toContain(NEW_B64);
  });

  it("blobs:false gövdesi motora geçer; foreign/unrotatable varsa 'kek-rotation-foreign' alarmı ve ⛔ adımı", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    vi.mocked(rotateKek).mockResolvedValue(okResult({ totals: { rewrap: 1, already: 0, foreign: 2, blob: 0, blobRotated: 0 }, foreignSamples: ["Case.symptoms#c9"] }));
    const res = await POST(mkReq({ secret: SECRET, newKek: NEW_B64, blobs: false }));
    expect(vi.mocked(rotateKek).mock.calls[0][0].blobs).toBe(false);
    const body = await res.json();
    expect(body.foreignSamples).toEqual(["Case.symptoms#c9"]);
    expect(body.nextSteps[0]).toMatch(/⛔/);
    expect(sendAlert).toHaveBeenCalledWith("kek-rotation-foreign", expect.any(String), expect.stringContaining("foreign=2"));
  });

  it("süre bütçesinde kesilen apply: KISMEN alarmı + 'yeniden çalıştırın' adımı; env değiştirme uyarısı", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    vi.mocked(rotateKek).mockResolvedValue(okResult({ mode: "apply", complete: false }));
    const body = await (await POST(mkReq({ secret: SECRET, newKek: NEW_B64, mode: "apply", confirm: CONFIRM_PHRASE }))).json();
    expect(body.complete).toBe(false);
    expect(body.nextSteps.join(" ")).toMatch(/DEĞİŞTİRMEYİN/);
    expect(sendAlert).toHaveBeenCalledWith("kek-rotation", expect.stringMatching(/KISMEN/), expect.any(String));
  });

  it("motor hata fırlatırsa 500 + audit HATA satırı (anahtarsız) + apply'da alarm", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    vi.mocked(rotateKek).mockRejectedValue(new Error("Neon P1001 bağlantı"));
    const res = await POST(mkReq({ secret: SECRET, newKek: NEW_B64, mode: "apply", confirm: CONFIRM_PHRASE }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Neon P1001");
    expect(JSON.stringify(body)).not.toContain(NEW_B64);
    const audit = vi.mocked(recordAccess).mock.calls[0][0];
    expect(audit.action).toBe("KEK_ROTATION");
    expect(audit.detail).toContain("HATA");
    expect(audit.detail).not.toContain(NEW_B64);
    expect(sendAlert).toHaveBeenCalledWith("kek-rotation", expect.stringMatching(/KESİLDİ/), expect.any(String));
  });

  it("doctorium deploy'unda 404 (rotasyon AURA projesinde koşar; DB ortak)", async () => {
    vi.resetModules();
    vi.stubEnv("BRAND_MODE", "doctorium");
    const mod = await import("@/app/api/admin/kek-rotate/route");
    const res = await mod.POST(mkReq({ secret: SECRET, newKek: NEW_B64 }));
    expect(res.status).toBe(404);
    expect(rotateKek).not.toHaveBeenCalled();
  });
});

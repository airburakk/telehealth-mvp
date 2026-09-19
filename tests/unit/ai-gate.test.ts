// Birim — lib/ai-gate.ts (kontrol raporu 2026-09-17 K04): AI'ya giden her yolun ortak kapısı.
// Kabul (rapor): rıza yok/geri alınmış/eski sürüm → 403 AI_CONSENT_REQUIRED · fazla büyük girdi → 413 · limit aşımı → 429 ·
// izin verilmeyen rol → 403. Sıra: rol → hız(kullanıcı) → hız(IP) → rıza → boyut. Hız/rıza mock; kapı saf sınanır.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rate-limit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    rateLimit: vi.fn(async (_key: string, _limit: number, _windowMs: number) => ({ ok: true, retryAfter: 0 })),
    clientIp: () => "10.0.0.9",
    tooMany: (retryAfter: number) => NextResponse.json({ error: "çok fazla istek", retryAfter }, { status: 429 }),
  };
});
vi.mock("@/lib/aura-consent", () => ({ activeConsent: vi.fn(async () => true) }));

import { requireAiTriage, AI_TRIAGE_LIMITS, AI_TRIAGE_ROLES } from "@/lib/ai-gate";
import { rateLimit } from "@/lib/rate-limit";
import { activeConsent } from "@/lib/aura-consent";
import type { SessionUser } from "@/lib/session";

const req = () => new Request("http://localhost/api/x", { method: "POST" });
const patient = { id: "p1", role: "PATIENT" } as SessionUser;
const body = (o: Record<string, unknown> = {}) => ({ symptoms: " baş ağrısı ", ...o });
const status = async (v: Awaited<ReturnType<typeof requireAiTriage>>) => (v.ok ? 200 : v.response.status);
const json = async (v: Awaited<ReturnType<typeof requireAiTriage>>) => (v.ok ? null : v.response.json());

beforeEach(() => {
  vi.mocked(rateLimit).mockReset().mockResolvedValue({ ok: true, retryAfter: 0 });
  vi.mocked(activeConsent).mockReset().mockResolvedValue(true);
});

describe("requireAiTriage — kapı sırası ve kodlar", () => {
  it("izin verilmeyen rol (DOCTOR/COORDINATOR/PARTNER) → 403 AI_ROLE_NOT_ALLOWED; hız ve rıza HİÇ sorulmaz", async () => {
    for (const role of ["DOCTOR", "COORDINATOR", "PARTNER", "AGENCY", "ETHICS"]) {
      const v = await requireAiTriage({ id: "u", role } as SessionUser, req(), body());
      expect(await status(v)).toBe(403);
      expect((await json(v)).code).toBe("AI_ROLE_NOT_ALLOWED");
    }
    expect(rateLimit).not.toHaveBeenCalled();
    expect(activeConsent).not.toHaveBeenCalled();
    expect(AI_TRIAGE_ROLES).toEqual(["PATIENT", "ADMIN"]);
  });

  it("kullanıcı kotası aşıldı → 429 (rıza sorulmadan)", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 17 });
    const v = await requireAiTriage(patient, req(), body());
    expect(await status(v)).toBe(429);
    expect(vi.mocked(rateLimit).mock.calls[0][0]).toBe("triage:p1");
    expect(activeConsent).not.toHaveBeenCalled();
  });

  it("IP kotası aşıldı → 429 (ikinci anahtar triage-ip:<ip>)", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: true, retryAfter: 0 }).mockResolvedValueOnce({ ok: false, retryAfter: 5 });
    const v = await requireAiTriage(patient, req(), body());
    expect(await status(v)).toBe(429);
    expect(vi.mocked(rateLimit).mock.calls[1][0]).toBe("triage-ip:10.0.0.9");
  });

  it("rıza yok / geri alınmış / eski sürüm (activeConsent=false) → 403 AI_CONSENT_REQUIRED", async () => {
    vi.mocked(activeConsent).mockResolvedValue(false);
    const v = await requireAiTriage(patient, req(), body());
    expect(await status(v)).toBe(403);
    expect((await json(v)).code).toBe("AI_CONSENT_REQUIRED");
    // rıza sorgusu doğru kapsam/sürümle
    expect(vi.mocked(activeConsent).mock.calls[0][0]).toBe("p1");
    expect(vi.mocked(activeConsent).mock.calls[0][1]).toBe("AI_TRIAGE");
  });

  it("şikayet > 4000 · yanıtlar JSON > 4000 · süre > 500 → 413 (kırpma YOK)", async () => {
    expect(await status(await requireAiTriage(patient, req(), body({ symptoms: "x".repeat(AI_TRIAGE_LIMITS.symptoms + 1) })))).toBe(413);
    expect(await status(await requireAiTriage(patient, req(), body({ answers: { a: "y".repeat(AI_TRIAGE_LIMITS.answersChars) } })))).toBe(413);
    expect(await status(await requireAiTriage(patient, req(), body({ durationText: "z".repeat(AI_TRIAGE_LIMITS.durationText + 1) })))).toBe(413);
    // tam sınır geçer
    expect(await status(await requireAiTriage(patient, req(), body({ symptoms: "x".repeat(AI_TRIAGE_LIMITS.symptoms) })))).toBe(200);
  });

  it("geçerli girdi → ok + normalize edilmiş input (trim, string dönüşümleri, boş süre undefined)", async () => {
    const v = await requireAiTriage(patient, req(), body({ answers: { q1: "a" }, forceBranchKey: 12, durationText: "" }));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.input).toEqual({ symptoms: "baş ağrısı", durationText: undefined, answers: { q1: "a" }, forceBranchKey: "12" });
    const admin = await requireAiTriage({ id: "a1", role: "ADMIN" } as SessionUser, req(), body());
    expect(admin.ok).toBe(true); // ADMIN demo/prova istisnası (tourism-request ile aynı)
  });
});

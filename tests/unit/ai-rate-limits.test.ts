// Birim — v6.295 (kontrol raporu K7): LLM'e giden dört uçta hız freni. Sınır aşılınca 429 + Retry-After ve
// PAHALI İŞ (çeviri / DB yazımı / token üretimi) HİÇ çağrılmaz; sınır geçilince akış normal devam eder.
// (triage/analyze bu dosyada YOK: 2026-09-17'den beri lib/ai-gate kullanıcı+IP sınırı taşır — triage-analyze-route.test.)
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...mod, rateLimit: vi.fn() };
});
vi.mock("@/lib/i18n", () => ({
  getTranslations: vi.fn(async () => ({ Merhaba: "Hello" })),
  translateClinical: vi.fn(async () => ({})),
  UI_LANGS: ["Türkçe", "English"],
}));
vi.mock("@/lib/db", () => ({
  db: {
    secondOpinionCase: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    case: { findUnique: vi.fn() },
    recovery: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/ownership", () => ({
  canSoCaseBeAccessedBy: vi.fn(async () => true),
  isCurrentUserCasePatient: vi.fn(async () => true),
}));
vi.mock("@/lib/postop-access", () => ({ recoveryClosed: vi.fn(() => ({ closed: true })) }));
vi.mock("@/lib/ai-clinical", () => ({ assessPostopNote: vi.fn(), assessPostopPhoto: vi.fn() }));
vi.mock("@/lib/postop", () => ({ assessCheckIn: vi.fn(), assessChecklist: vi.fn(), worstSeverity: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyDoctorById: vi.fn() }));
vi.mock("@/lib/clinical-duty", () => ({ notifyOnDutySentinels: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ encryptField: vi.fn((s: string) => s) }));
vi.mock("@/lib/document-mime", () => ({ detectDocumentKind: vi.fn() }));

import { POST as i18nPost } from "@/app/api/i18n/route";
import { POST as clinicalPost } from "@/app/api/i18n/clinical/route";
import { POST as tokenPost } from "@/app/api/realtime/token/route";
import { POST as checkinPost } from "@/app/api/cases/[id]/checkin/route";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getTranslations } from "@/lib/i18n";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const json = (url: string, body: unknown) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const BLOCK = { ok: false, retryAfter: 7 };
const PASS = { ok: true, retryAfter: 0 };

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset().mockResolvedValue({ id: "u1", role: "PATIENT" } as SessionUser);
  vi.mocked(rateLimit).mockReset();
  vi.mocked(getTranslations).mockClear();
  vi.mocked(db.secondOpinionCase.findUnique).mockReset();
  vi.mocked(db.recovery.upsert).mockReset().mockResolvedValue({} as never);
  vi.mocked(db.case.findUnique).mockReset().mockResolvedValue({ id: "c1", branch: "Ortopedi" } as never);
  delete process.env.GEMINI_API_KEY;
});

describe("POST /api/i18n — arayüz çevirisi", () => {
  it("sınır aşıldı → 429 + Retry-After; getTranslations ÇAĞRILMAZ", async () => {
    vi.mocked(rateLimit).mockResolvedValue(BLOCK);
    const r = await i18nPost(json("http://localhost/api/i18n", { lang: "English", texts: ["Merhaba"] }));
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("7");
    expect(getTranslations).not.toHaveBeenCalled();
  });
  it("sınır geçildi → kova i18n:<user>, 60/dk; çeviri çağrılır", async () => {
    vi.mocked(rateLimit).mockResolvedValue(PASS);
    const r = await i18nPost(json("http://localhost/api/i18n", { lang: "English", texts: ["Merhaba"] }));
    expect(r.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith("i18n:u1", 60, 60_000);
    expect(getTranslations).toHaveBeenCalledTimes(1);
  });
  it("kimliksiz → 401, sınır sayacı hiç dokunulmaz", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await i18nPost(json("http://localhost/api/i18n", { texts: ["x"] }))).status).toBe(401);
    expect(rateLimit).not.toHaveBeenCalled();
  });
});

describe("POST /api/i18n/clinical — İkinci Görüş klinik metni (önbelleksiz)", () => {
  it("sınır aşıldı → 429; DB okuması bile yapılmaz", async () => {
    vi.mocked(rateLimit).mockResolvedValue(BLOCK);
    const r = await clinicalPost(json("http://localhost/api/i18n/clinical", { soCaseId: "so1", lang: "English", texts: ["x"] }));
    expect(r.status).toBe(429);
    expect(db.secondOpinionCase.findUnique).not.toHaveBeenCalled();
  });
  it("sınır geçildi → ayrı kova i18n-clinical:<user>, 30/dk; akış devam eder (vaka yok → 404)", async () => {
    vi.mocked(rateLimit).mockResolvedValue(PASS);
    vi.mocked(db.secondOpinionCase.findUnique).mockResolvedValue(null as never);
    const r = await clinicalPost(json("http://localhost/api/i18n/clinical", { soCaseId: "so1", lang: "English", texts: ["x"] }));
    expect(r.status).toBe(404);
    expect(rateLimit).toHaveBeenCalledWith("i18n-clinical:u1", 30, 60_000);
  });
});

describe("POST /api/realtime/token — Gemini Live token", () => {
  it("sınır aşıldı → 429 (dormant kontrolünden bile önce)", async () => {
    vi.mocked(rateLimit).mockResolvedValue(BLOCK);
    const r = await tokenPost(json("http://localhost/api/realtime/token", { targetLang: "ru" }));
    expect(r.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("rt-token:u1", 10, 60_000);
  });
  it("sınır geçildi + anahtar yok → 503 dormant (akış sınırdan sonra normal sürer)", async () => {
    vi.mocked(rateLimit).mockResolvedValue(PASS);
    const r = await tokenPost(json("http://localhost/api/realtime/token", { targetLang: "ru" }));
    expect(r.status).toBe(503);
  });
});

describe("POST /api/cases/[id]/checkin — post-op kontrol", () => {
  const params = { params: Promise.resolve({ id: "c1" }) };
  it("sınır aşıldı → 429; recovery upsert (DB yazımı) HİÇ çağrılmaz", async () => {
    vi.mocked(rateLimit).mockResolvedValue(BLOCK);
    const r = await checkinPost(json("http://localhost/api/cases/c1/checkin", { pain: 3 }), params);
    expect(r.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("checkin:c1", 10, 60_000);
    expect(db.recovery.upsert).not.toHaveBeenCalled();
  });
  it("sınır geçildi → akış sürer (takip kapalı → 409), sıra: sahiplik → sınır → yazım", async () => {
    vi.mocked(rateLimit).mockResolvedValue(PASS);
    const r = await checkinPost(json("http://localhost/api/cases/c1/checkin", { pain: 3 }), params);
    expect(r.status).toBe(409);
    expect(db.recovery.upsert).toHaveBeenCalledTimes(1);
  });
  it("vaka yok → 404, sınır sayacı dokunulmaz", async () => {
    vi.mocked(db.case.findUnique).mockResolvedValue(null as never);
    expect((await checkinPost(json("http://localhost/api/cases/c1/checkin", { pain: 3 }), params)).status).toBe(404);
    expect(rateLimit).not.toHaveBeenCalled();
  });
});

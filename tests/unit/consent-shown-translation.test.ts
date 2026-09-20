// Birim — Paket 7 (v6.285) onam ispat eki: /api/consent gövdedeki `shown`ı doğrulayıp recordPatientConsent'e geçirir;
// recordConsent kaydı shownLang/shownTextHash ile yazar (mühür formülü DEĞİŞMEZ — kanonik textHash aynı); TR/EN okuyan
// hastada sütunlar null. Sunucu tarafı fonksiyonlar mock db ile sınanır.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(), createSession: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(async () => ({ doctorId: null })) },
    consentRecord: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
  },
}));
vi.mock("@/lib/doctorium-consent", () => ({ gateConsentVersion: vi.fn(async () => 4), recordDoctoriumConsent: vi.fn(async () => undefined) }));
vi.mock("@/lib/aura-consent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aura-consent")>("@/lib/aura-consent");
  return { ...actual, recordPatientConsent: vi.fn(async () => undefined), recordStaffConsent: vi.fn(async () => undefined) };
});
vi.mock("@/lib/doctor-activation", () => ({ refreshActivation: vi.fn(async () => undefined) }));
vi.mock("@/lib/alerts", () => ({ sendAlert: vi.fn(async () => undefined) }));

const created: Record<string, unknown>[] = [];
const txMock = {
  $executeRaw: vi.fn(async () => 0),
  consentRecord: {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => { created.push(args.data); return args.data; }),
  },
};

import { POST } from "@/app/api/consent/route";
import { getCurrentUser } from "@/lib/auth";
import { recordPatientConsent } from "@/lib/aura-consent";
import { recordConsent } from "@/lib/consent";
import type { SessionUser } from "@/lib/session";

const PATIENT = { id: "p1", email: "h@air.test", name: "Hasta", role: "PATIENT", cv: 0, sv: 0 } as unknown as SessionUser;
const H = "b".repeat(64);
const req = (body: unknown) => new Request("http://x/api/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("/api/consent — shown", () => {
  beforeEach(() => { vi.mocked(getCurrentUser).mockResolvedValue(PATIENT); vi.mocked(recordPatientConsent).mockClear(); });
  it("geçerli shown → recordPatientConsent'e geçer (lang kanonik EN)", async () => {
    const res = await POST(req({ kind: "general", lang: "en", shown: { lang: "Rusça", aydinlatmaHash: H, kosullarHash: H } }));
    expect(res.status).toBe(200);
    expect(vi.mocked(recordPatientConsent).mock.calls[0].slice(0, 2)).toEqual(["p1", "en"]);
    expect(vi.mocked(recordPatientConsent).mock.calls[0][4]).toEqual({ lang: "Rusça", aydinlatmaHash: H, kosullarHash: H });
  });
  it("geçersiz/yok shown → null (kayıt yine yazılır)", async () => {
    await POST(req({ kind: "general", lang: "tr", shown: { lang: "Türkçe", aydinlatmaHash: H, kosullarHash: H } }));
    expect(vi.mocked(recordPatientConsent).mock.calls[0][4]).toBeNull();
    await POST(req({ kind: "general", lang: "tr" }));
    expect(vi.mocked(recordPatientConsent).mock.calls[1][4]).toBeNull();
  });
});

describe("recordConsent — shownLang/shownTextHash sütunları", () => {
  beforeEach(() => { created.length = 0; });
  it("verilirse kayda yazılır; textHash kanonik metnin hash'i olarak kalır", async () => {
    await recordConsent("p1", "1.1.1.1", "UA", { scope: "GENERAL_KVKK", version: 4, text: "KANONİK", shownLang: "Rusça", shownTextHash: H });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ scope: "GENERAL_KVKK", version: 4, shownLang: "Rusça", shownTextHash: H });
    expect(typeof created[0].textHash).toBe("string");
    expect(created[0].textHash).not.toBe(H);
    expect(created[0].entryHash).toBeTruthy();
  });
  it("verilmezse null", async () => {
    await recordConsent("p1", null, null, { scope: "AURA_TERMS", version: 1, text: "T" });
    expect(created[0]).toMatchObject({ shownLang: null, shownTextHash: null });
  });
});

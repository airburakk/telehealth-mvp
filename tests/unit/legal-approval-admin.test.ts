// Birim — 7-C (v6.286) yönetim kapıları: POST /api/admin/hukuki-ceviri yalnız ADMIN (401), belge/işlem doğrulama (400),
// dil kodu → Türkçe ad çözümü, onay çakışması 409, üretim sayaçları; /admin/hukuki-ceviri sayfası oturumsuz → /giris?next,
// ADMIN dışı → / ve kuyruk sorgusu HİÇ çağrılmaz ([[sayfa-modulu-kapi-testleri]]).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: "9.9.9.9", userAgent: "vitest" }) }));
vi.mock("@/lib/legal-approval", () => {
  class LegalApprovalConflict extends Error {}
  return {
    LegalApprovalConflict,
    LEGAL_QUEUE_STATE_LABEL: { reviewed: "İncelenmiş", automatic: "Otomatik", incomplete: "Eksik", missing: "Üretilmedi", stale: "Eskidi", revoked: "Geri alındı" },
    approveLegalTranslation: vi.fn(),
    revokeLegalTranslation: vi.fn(async () => {}),
    generateLegalTranslation: vi.fn(),
    listLegalTranslationQueue: vi.fn(async () => []),
    legalQueueState: vi.fn(() => "automatic"),
    getLegalApproval: vi.fn(async () => null),
    resolveLegalBody: vi.fn(async () => null),
  };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));

import { POST } from "@/app/api/admin/hukuki-ceviri/route";
import LegalTranslationQueuePage from "@/app/admin/hukuki-ceviri/page";
import { getCurrentUser } from "@/lib/auth";
import { approveLegalTranslation, generateLegalTranslation, LegalApprovalConflict, listLegalTranslationQueue, revokeLegalTranslation } from "@/lib/legal-approval";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const ADMIN: Partial<SessionUser> = { id: "a1", email: "admin@air.test", name: "Yönetici", role: "ADMIN" };
const call = (body: unknown) => POST(new Request("http://x/api/admin/hukuki-ceviri", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(approveLegalTranslation).mockReset();
  vi.mocked(generateLegalTranslation).mockReset();
  vi.mocked(revokeLegalTranslation).mockClear();
  vi.mocked(listLegalTranslationQueue).mockClear();
});

describe("POST /api/admin/hukuki-ceviri — kapı + sözleşme", () => {
  it("oturumsuz ve ADMIN dışı → 401; lib çağrılmaz", async () => {
    asUser(null);
    expect((await call({ slug: "aydinlatma", lang: "ru", action: "approve" })).status).toBe(401);
    for (const role of ["PATIENT", "DOCTOR", "COORDINATOR", "ETHICS"]) {
      asUser({ ...ADMIN, role } as Partial<SessionUser>);
      expect((await call({ slug: "aydinlatma", lang: "ru", action: "approve" })).status).toBe(401);
    }
    expect(approveLegalTranslation).not.toHaveBeenCalled();
  });

  it("ADMIN approve: dil kodu Türkçe ada çözülür, textHash/not/istek meta'sı lib'e gider → 200", async () => {
    asUser(ADMIN);
    vi.mocked(approveLegalTranslation).mockResolvedValue({ id: "r1", approvedAt: new Date("2026-09-20T10:00:00Z") } as never);
    const res = await call({ slug: "aydinlatma", lang: "ru", action: "approve", textHash: "f".repeat(64), note: "ok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(approveLegalTranslation).toHaveBeenCalledWith(expect.objectContaining({
      slug: "aydinlatma", lang: "Rusça", textHash: "f".repeat(64), note: "ok", ip: "9.9.9.9", userAgent: "vitest", actor: expect.objectContaining({ id: "a1" }),
    }));
  });

  it("onay çakışması (metin değişti) → 409; diğer lib hataları → 400 mesajıyla", async () => {
    asUser(ADMIN);
    vi.mocked(approveLegalTranslation).mockRejectedValueOnce(new LegalApprovalConflict("değişti"));
    const c = await call({ slug: "aydinlatma", lang: "Rusça", action: "approve", textHash: "f".repeat(64) });
    expect(c.status).toBe(409);
    expect((await c.json()).error).toBe("değişti");
    vi.mocked(approveLegalTranslation).mockRejectedValueOnce(new Error("Çeviri önbellekte yok — önce üretin."));
    const e = await call({ slug: "aydinlatma", lang: "Rusça", action: "approve", textHash: "f".repeat(64) });
    expect(e.status).toBe(400);
    expect((await e.json()).error).toMatch(/önce üretin/);
  });

  it("bilinmeyen belge ve geçersiz işlem → 400; revoke ve generate lib'e gider", async () => {
    asUser(ADMIN);
    expect((await call({ slug: "yok", lang: "ru", action: "approve" })).status).toBe(400);
    expect((await call({ slug: "aydinlatma", lang: "ru", action: "sil" })).status).toBe(400);
    expect((await call({ slug: "aydinlatma", lang: "ru", action: "revoke" })).status).toBe(200);
    expect(revokeLegalTranslation).toHaveBeenCalledWith(expect.objectContaining({ slug: "aydinlatma", lang: "Rusça" }));
    vi.mocked(generateLegalTranslation).mockResolvedValue({ markdown: "x", complete: false, units: 40, translated: 37 });
    const g = await call({ slug: "cerez", lang: "de", action: "generate" });
    expect(await g.json()).toEqual({ ok: true, units: 40, translated: 37, complete: false });
    vi.mocked(generateLegalTranslation).mockResolvedValue(null);
    expect(await (await call({ slug: "cerez", lang: "de", action: "generate" })).json()).toEqual({ ok: true, units: 0, translated: 0, complete: false });
  });
});

describe("/admin/hukuki-ceviri sayfa kapısı", () => {
  it("oturumsuz → /giris?next=…; ADMIN dışı → /; kuyruk sorgusu çağrılmaz", async () => {
    asUser(null);
    await expect(LegalTranslationQueuePage()).rejects.toThrow("REDIRECT:/giris?next=/admin/hukuki-ceviri");
    asUser({ ...ADMIN, role: "DOCTOR" } as Partial<SessionUser>);
    await expect(LegalTranslationQueuePage()).rejects.toThrow("REDIRECT:/");
    expect(listLegalTranslationQueue).not.toHaveBeenCalled();
  });

  it("ADMIN → kuyruk okunur, sayfa çizilir", async () => {
    asUser(ADMIN);
    const el = await LegalTranslationQueuePage();
    expect(el).toBeTruthy();
    expect(listLegalTranslationQueue).toHaveBeenCalledTimes(1);
  });
});

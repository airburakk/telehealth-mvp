// İçerik takvimi — POST /api/admin/hukuki-ceviri deseniyle /api/admin/icerik-takvimi kapı + sözleşme testleri (v6.328, 2026-10-06):
// yalnız ADMIN (401, lib HİÇ çağrılmaz) · işlem doğrulama (400) · her eylem lib'e doğru argümanla gider · hata → durum kodu eşlemesi
// (PlanGateError 422 + rapor · PlanError kendi kodu · beklenmeyen 500 İÇ MESAJ SIZDIRMAZ) · önizleme hız sınırı 429 + servis hataları.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: "9.9.9.9", userAgent: "vitest" }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true, retryAfter: 0 })) }));
vi.mock("@/lib/social-calendar/plan", () => {
  class PlanError extends Error {
    constructor(
      message: string,
      readonly status: number = 400,
    ) {
      super(message);
    }
  }
  class PlanGateError extends PlanError {
    constructor(readonly report: unknown) {
      super("Onay kapıları geçilmedi.", 422);
    }
  }
  return {
    PlanError,
    PlanGateError,
    openSlot: vi.fn(),
    computeCandidates: vi.fn(),
    pickSource: vi.fn(),
    saveDraft: vi.fn(),
    approve: vi.fn(),
    unapprove: vi.fn(),
    skip: vi.fn(),
    restore: vi.fn(),
    previewPlan: vi.fn(),
    markPublished: vi.fn(),
    retryPublish: vi.fn(),
  };
});

import { POST } from "@/app/api/admin/icerik-takvimi/route";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import * as plan from "@/lib/social-calendar/plan";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const ADMIN: Partial<SessionUser> = { id: "a1", email: "admin@air.test", name: "Yönetici", role: "ADMIN" };
const call = (body: unknown) => POST(new Request("http://x/api/admin/icerik-takvimi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const VIEW = { id: "p1", status: "DRAFT", version: "2026-10-06T12:00:01.000Z" };

const MOCKS = [plan.openSlot, plan.computeCandidates, plan.pickSource, plan.saveDraft, plan.approve, plan.unapprove, plan.skip, plan.restore, plan.previewPlan, plan.markPublished, plan.retryPublish];

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  for (const m of MOCKS) vi.mocked(m).mockReset();
  vi.mocked(rateLimit).mockClear();
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 });
});

describe("kapı", () => {
  it("oturumsuz ve ADMIN dışı → 401; hiçbir lib işlevi çağrılmaz", async () => {
    asUser(null);
    expect((await call({ action: "approve", id: "p1" })).status).toBe(401);
    expect((await call({ action: "publish", id: "p1", channels: [{ channel: "instagram" }] })).status).toBe(401);
    for (const role of ["PATIENT", "DOCTOR", "COORDINATOR", "ETHICS", "PARTNER"]) {
      asUser({ ...ADMIN, role } as Partial<SessionUser>);
      expect((await call({ action: "approve", id: "p1" })).status).toBe(401);
      expect((await call({ action: "publish", id: "p1", channels: [{ channel: "instagram" }] })).status).toBe(401);
      expect((await call({ action: "retry", id: "p1" })).status).toBe(401);
    }
    for (const m of MOCKS) expect(m).not.toHaveBeenCalled();
  });
  it("geçersiz/boş işlem → 400", async () => {
    asUser(ADMIN);
    expect((await call({ action: "yok" })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await POST(new Request("http://x", { method: "POST", body: "bozuk json" }))).status).toBe(400);
  });
});

describe("eylemler lib'e doğru argümanla gider", () => {
  beforeEach(() => {
    asUser(ADMIN);
    for (const m of MOCKS) vi.mocked(m).mockResolvedValue(VIEW as never);
  });
  it("open", async () => {
    const res = await call({ action: "open", seriesKey: "karar-masasi", slotDay: "2026-10-07" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, item: { id: "p1" } });
    expect(plan.openSlot).toHaveBeenCalledWith({ seriesKey: "karar-masasi", slotDay: "2026-10-07" });
  });
  it("candidates: görünüm + sayaçlar döner", async () => {
    vi.mocked(plan.computeCandidates).mockResolvedValue({ view: VIEW, stats: { total: 5, eligible: 3, rejected: {} } } as never);
    const body = await (await call({ action: "candidates", id: "p1" })).json();
    expect(body).toMatchObject({ ok: true, item: { id: "p1" }, stats: { eligible: 3 } });
    expect(plan.computeCandidates).toHaveBeenCalledWith({ id: "p1" });
  });
  it("pick/approve/unapprove/skip/restore: id + version + aktör + istek meta'sı", async () => {
    const common = expect.objectContaining({ id: "p1", expectedVersion: VIEW.version, ip: "9.9.9.9", userAgent: "vitest", actor: expect.objectContaining({ id: "a1" }) });
    await call({ action: "pick", id: "p1", version: VIEW.version, articleId: "n1" });
    expect(plan.pickSource).toHaveBeenCalledWith(expect.objectContaining({ articleId: "n1" }));
    expect(plan.pickSource).toHaveBeenCalledWith(common);
    for (const [action, fn] of [["approve", plan.approve], ["unapprove", plan.unapprove], ["skip", plan.skip], ["restore", plan.restore]] as const) {
      expect((await call({ action, id: "p1", version: VIEW.version })).status).toBe(200);
      expect(fn).toHaveBeenCalledWith(common);
    }
  });
  it("save: yalnız VERİLEN alanlar iletilir (kısmi güncelleme — eksik alan 'silme' demek değildir)", async () => {
    await call({ action: "save", id: "p1", version: VIEW.version, editorNote: "1) a\n2) b\n3) c" });
    const a1 = vi.mocked(plan.saveDraft).mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(a1.editorNote).toBe("1) a\n2) b\n3) c");
    expect("payload" in a1).toBe(false);
    expect("attestIdentity" in a1).toBe(false);

    await call({ action: "save", id: "p1", version: VIEW.version, attestIdentity: true, payload: { slides: [] } });
    const a2 = vi.mocked(plan.saveDraft).mock.calls[1]![0] as unknown as Record<string, unknown>;
    expect(a2.attestIdentity).toBe(true);
    expect(a2.payload).toEqual({ slides: [] });
    expect("editorNote" in a2).toBe(false);
  });
  it("publish: kanallar HAM iletilir (doğrulama lib'de), `manual:true` UÇTA sabitlenir (gövdeyle ezilemez), aktör + istek meta'sı eşlik eder", async () => {
    const channels = [{ channel: "instagram", url: "https://www.instagram.com/p/A/" }, { channel: "x" }];
    const res = await call({ action: "publish", id: "p1", version: VIEW.version, channels, manual: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, item: { id: "p1" } });
    expect(plan.markPublished).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", expectedVersion: VIEW.version, channels, manual: true, ip: "9.9.9.9", userAgent: "vitest", actor: expect.objectContaining({ id: "a1" }) }));
  });
  it("retry: id + version + aktör", async () => {
    expect((await call({ action: "retry", id: "p1", version: VIEW.version })).status).toBe(200);
    expect(plan.retryPublish).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", expectedVersion: VIEW.version, actor: expect.objectContaining({ id: "a1" }) }));
  });
  it("sürüm gövdede yoksa boş dize olarak lib'e gider (lib 400 verir — uç sürümü uydurmaz)", async () => {
    await call({ action: "skip", id: "p1" });
    expect(plan.skip).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: "" }));
  });
});

describe("hata → durum kodu", () => {
  beforeEach(() => asUser(ADMIN));
  it("PlanGateError → 422 + rapor gövdede", async () => {
    const report = { ok: false, checkedAt: "x", gates: [{ id: "cikarim", ok: false }] };
    vi.mocked(plan.approve).mockRejectedValueOnce(new plan.PlanGateError(report as never));
    const res = await call({ action: "approve", id: "p1", version: "v" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "Onay kapıları geçilmedi.", report });
  });
  it("PlanError kendi kodunu taşır (404 / 409 / 400)", async () => {
    for (const status of [404, 409, 400]) {
      vi.mocked(plan.skip).mockRejectedValueOnce(new plan.PlanError(`hata ${status}`, status));
      const res = await call({ action: "skip", id: "p1", version: "v" });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: `hata ${status}` });
    }
  });
  it("publish: geçersiz kanal 400 / mühür bozuk 409 / sürüm çakışması 409 aynı kodla yansır", async () => {
    for (const [status, message] of [[400, "En az bir kanal seçin."], [409, "İçerik onay mührüyle eşleşmiyor."], [409, "İçerik, sayfayı açtığınızdan beri değişti."]] as const) {
      vi.mocked(plan.markPublished).mockRejectedValueOnce(new plan.PlanError(message, status));
      const res = await call({ action: "publish", id: "p1", version: "v", channels: [] });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    }
  });
  it("beklenmeyen hata → 500, İÇ MESAJ sızdırılmaz", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(plan.approve).mockRejectedValueOnce(new Error("PrismaClientKnownRequestError: tablo ContentPlanItem yok"));
    const res = await call({ action: "approve", id: "p1", version: "v" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("Prisma");
    expect(body.error).toBe("İşlem tamamlanamadı.");
    spy.mockRestore();
  });
});

describe("preview", () => {
  beforeEach(() => asUser(ADMIN));
  it("başarı: slaytlar döner; ekrandaki (kaydedilmemiş) payload/not iletilir", async () => {
    vi.mocked(plan.previewPlan).mockResolvedValue({ ok: true, slides: [{ index: 0, role: "kapak", png: "iVBORw0KGgo=" }] } as never);
    const res = await call({ action: "preview", id: "p1", payload: { slides: [] }, editorNote: "x" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, slides: [{ role: "kapak" }] });
    expect(plan.previewPlan).toHaveBeenCalledWith({ id: "p1", payload: { slides: [] }, editorNote: "x" });
  });
  it("hız sınırı aşılınca 429 + Retry-After; servis çağrılmaz", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 42 });
    const res = await call({ action: "preview", id: "p1" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(plan.previewPlan).not.toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledWith("icerik-takvimi-preview:a1", 30, 600_000);
  });
  it("servis hataları (503 yapılandırılmamış/meşgul · 502 · 504) aynı kodla yansır", async () => {
    for (const status of [503, 502, 504]) {
      vi.mocked(plan.previewPlan).mockResolvedValueOnce({ ok: false, status, error: `servis ${status}` } as never);
      const res = await call({ action: "preview", id: "p1" });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: `servis ${status}` });
    }
  });
});

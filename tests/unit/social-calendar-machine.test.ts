// İçerik takvimi MAKİNE yüzeyi (POST /api/social-calendar/yayin, v6.334, 2026-10-06) kapı + sözleşme testleri: jeton yoksa DORMANT 503 · yanlış jeton 401 (AYRI jeton:
// SOCIAL_DIGEST_TOKEN KABUL EDİLMEZ) · her eylem lib'e doğru argümanla gider (aktör null, bugün TR, manual:false uçta SABİT) · sonuç bildirimi İDEMPOTENT (yalnız
// otomasyonun kendi sonucu "tekrar" sayılır; editör elle işaretlediyse çakışma gerçektir) · hata → durum kodu eşlemesi (beklenmeyen 500 İÇ MESAJ SIZDIRMAZ).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit", () => ({ reqMeta: () => ({ ip: "9.9.9.9", userAgent: "kart" }) }));
vi.mock("@/lib/iso-day", () => ({ todayIsoTr: () => "2026-10-07" }));
vi.mock("@/lib/social-calendar/plan", () => {
  class PlanError extends Error {
    constructor(
      message: string,
      readonly status: number = 400,
    ) {
      super(message);
    }
  }
  return { PlanError, dueForDay: vi.fn(), claimForPublish: vi.fn(), markPublished: vi.fn(), markPublishFailed: vi.fn(), getItem: vi.fn() };
});

import { POST } from "@/app/api/social-calendar/yayin/route";
import * as plan from "@/lib/social-calendar/plan";

const TOKEN = "yerel-test-jetonu-0123456789abcdef";
const call = (body: unknown, auth: string | null = `Bearer ${TOKEN}`) =>
  POST(
    new Request("http://x/api/social-calendar/yayin", {
      method: "POST",
      headers: { "content-type": "application/json", ...(auth === null ? {} : { authorization: auth }) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const MOCKS = [plan.dueForDay, plan.claimForPublish, plan.markPublished, plan.markPublishFailed, plan.getItem];
const SNAP = { gun: "2026-10-07", items: [{ id: "p1", version: "v2" }], atlanan: [], slotlar: [{ id: "p1", seriesKey: "karar-masasi", status: "PUBLISHING" }] };
const CTX = { actor: null, ip: "9.9.9.9", userAgent: "kart" };

beforeEach(() => {
  vi.stubEnv("CONTENT_PLAN_TOKEN", TOKEN);
  vi.stubEnv("SOCIAL_DIGEST_TOKEN", "baska-jeton-social-digest");
  for (const m of MOCKS) vi.mocked(m).mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("kapı", () => {
  it("CONTENT_PLAN_TOKEN tanımsız/boş → 503 (DORMANT); hiçbir lib işlevi çağrılmaz", async () => {
    vi.stubEnv("CONTENT_PLAN_TOKEN", "");
    const res = await call({ action: "bak", gun: "2026-10-07" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("CONTENT_PLAN_TOKEN");
    for (const m of MOCKS) expect(m).not.toHaveBeenCalled();
  });
  it("jetonsuz · yanlış · farklı uzunlukta · Bearer-dışı şema · SOCIAL_DIGEST_TOKEN → 401 (AYRI jeton); lib çağrılmaz", async () => {
    for (const auth of [null, "Bearer yanlis", `Bearer ${TOKEN}x`, `Bearer ${TOKEN.slice(0, -1)}`, `Basic ${TOKEN}`, "Bearer baska-jeton-social-digest", ""]) {
      const res = await call({ action: "al", gun: "2026-10-07" }, auth);
      expect(res.status, String(auth)).toBe(401);
    }
    for (const m of MOCKS) expect(m).not.toHaveBeenCalled();
  });
  it("geçersiz/boş işlem ve bozuk JSON → 400", async () => {
    expect((await call({ action: "yok" })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call("bozuk json")).status).toBe(400);
    for (const m of MOCKS) expect(m).not.toHaveBeenCalled();
  });
});

describe("bak / al", () => {
  it("bak: YALNIZ okuma — dueForDay(gun) döner; claim/sonuç çağrılmaz", async () => {
    vi.mocked(plan.dueForDay).mockResolvedValue(SNAP as never);
    const res = await call({ action: "bak", gun: "2026-10-14" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, gun: "2026-10-07", items: [{ id: "p1" }] });
    expect(plan.dueForDay).toHaveBeenCalledWith("2026-10-14"); // bak HER gün için serbest
    expect(plan.claimForPublish).not.toHaveBeenCalled();
    expect(plan.markPublished).not.toHaveBeenCalled();
  });
  it("al: bugün (TR) SUNUCUDA hesaplanır (istemci veremez); aktör null + istek meta'sı eşlik eder", async () => {
    vi.mocked(plan.claimForPublish).mockResolvedValue(SNAP as never);
    const res = await call({ action: "al", gun: "2026-10-07", bugun: "2099-01-01" }); // gövdedeki `bugun` YOK SAYILIR
    expect(res.status).toBe(200);
    expect(plan.claimForPublish).toHaveBeenCalledWith({ gun: "2026-10-07", bugun: "2026-10-07", ...CTX });
  });
  it("gün/bugün uyuşmazlığı ve geçersiz gün lib hatasıyla 400 olarak yansır", async () => {
    vi.mocked(plan.claimForPublish).mockRejectedValueOnce(new plan.PlanError("Yalnız bugünün (2026-10-07) içeriği alınabilir; istenen: 2026-10-14.", 400));
    const res = await call({ action: "al", gun: "2026-10-14" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Yalnız bugünün");
  });
});

describe("sonuc", () => {
  it("ok: kanallar + başarısızlar HAM iletilir (doğrulama lib'de); manual:false uçta SABİT (gövdeyle ezilemez); aktör null", async () => {
    vi.mocked(plan.markPublished).mockResolvedValue({ status: "PUBLISHED", version: "v3" } as never);
    const kanallar = [{ channel: "instagram", url: "https://www.instagram.com/p/X/" }];
    const basarisiz = [{ channel: "linkedin", error: "429" }];
    const res = await call({ action: "sonuc", durum: "ok", id: "p1", version: "v2", kanallar, basarisiz, manual: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, durum: "PUBLISHED", version: "v3" });
    expect(plan.markPublished).toHaveBeenCalledWith({ id: "p1", expectedVersion: "v2", channels: kanallar, failures: basarisiz, manual: false, ...CTX });
    expect(plan.markPublishFailed).not.toHaveBeenCalled();
  });
  it("hata: markPublishFailed(hata metni) çağrılır", async () => {
    vi.mocked(plan.markPublishFailed).mockResolvedValue({ status: "FAILED", version: "v3" } as never);
    const res = await call({ action: "sonuc", durum: "hata", id: "p1", version: "v2", hata: "Instagram 400" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, durum: "FAILED", version: "v3" });
    expect(plan.markPublishFailed).toHaveBeenCalledWith({ id: "p1", expectedVersion: "v2", error: "Instagram 400", ...CTX });
    expect(plan.markPublished).not.toHaveBeenCalled();
  });
  it("`durum` ok/hata dışındaysa 400; lib çağrılmaz", async () => {
    for (const durum of ["", "basari", "OK", undefined]) {
      expect((await call({ action: "sonuc", durum, id: "p1", version: "v2" })).status, String(durum)).toBe(400);
    }
    expect(plan.markPublished).not.toHaveBeenCalled();
    expect(plan.markPublishFailed).not.toHaveBeenCalled();
  });
});

describe("sonuc — İDEMPOTENSİ", () => {
  const ok = { action: "sonuc", durum: "ok", id: "p1", version: "eski", kanallar: [{ channel: "x" }] };
  const hata = { action: "sonuc", durum: "hata", id: "p1", version: "eski", hata: "x" };
  it("aynı OK sonucu ikinci kez gelirse (ağ yeniden denemesi) 200 tekrar:true — otomasyonun kendi PUBLISHED'ı", async () => {
    vi.mocked(plan.markPublished).mockRejectedValueOnce(new plan.PlanError("Yalnız onaylı ya da yayınlanmakta olan içerik …", 409));
    vi.mocked(plan.getItem).mockResolvedValue({ status: "PUBLISHED", version: "v9", publication: { manual: false } } as never);
    const res = await call(ok);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, tekrar: true, durum: "PUBLISHED", version: "v9" });
  });
  it("aynı HATA sonucu ikinci kez gelirse 200 tekrar:true — otomasyonun kendi FAILED'ı", async () => {
    vi.mocked(plan.markPublishFailed).mockRejectedValueOnce(new plan.PlanError("Yalnız ALINMIŞ …", 409));
    vi.mocked(plan.getItem).mockResolvedValue({ status: "FAILED", version: "v9", publication: { manual: false } } as never);
    const res = await call(hata);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, tekrar: true, durum: "FAILED" });
  });
  it("editör ELLE işaretlediyse (manual:true) otomasyon sonucu 409 olarak yansır — çakışma GERÇEKTİR, sessizce yutulmaz", async () => {
    vi.mocked(plan.markPublished).mockRejectedValueOnce(new plan.PlanError("Yalnız onaylı …", 409));
    vi.mocked(plan.getItem).mockResolvedValue({ status: "PUBLISHED", version: "v9", publication: { manual: true } } as never);
    const res = await call(ok);
    expect(res.status).toBe(409);
  });
  it("durum beklenenden farklıysa (ör. FAILED iken ok bildirimi) 409; yuva yoksa 404; 409-dışı hata getItem'a BAKMAZ", async () => {
    vi.mocked(plan.markPublished).mockRejectedValueOnce(new plan.PlanError("çakışma", 409));
    vi.mocked(plan.getItem).mockResolvedValue({ status: "FAILED", version: "v9", publication: { manual: false } } as never);
    expect((await call(ok)).status).toBe(409);

    vi.mocked(plan.getItem).mockClear();
    vi.mocked(plan.markPublished).mockRejectedValueOnce(new plan.PlanError("Yuva bulunamadı.", 404));
    expect((await call(ok)).status).toBe(404);
    vi.mocked(plan.markPublished).mockRejectedValueOnce(new plan.PlanError("En az bir kanal seçin.", 400));
    expect((await call(ok)).status).toBe(400);
    expect(plan.getItem).not.toHaveBeenCalled();
  });
});

describe("hata eşlemesi", () => {
  it("PlanError kendi kodunu taşır; beklenmeyen hata 500 ve İÇ MESAJ sızdırılmaz", async () => {
    vi.mocked(plan.dueForDay).mockRejectedValueOnce(new plan.PlanError("Geçersiz gün (YYYY-AA-GG bekleniyor).", 400));
    const a = await call({ action: "bak", gun: "bozuk" });
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual({ error: "Geçersiz gün (YYYY-AA-GG bekleniyor)." });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(plan.claimForPublish).mockRejectedValueOnce(new Error("PrismaClientKnownRequestError: tablo ContentPlanItem yok"));
    const b = await call({ action: "al", gun: "2026-10-07" });
    expect(b.status).toBe(500);
    const body = await b.json();
    expect(JSON.stringify(body)).not.toContain("Prisma");
    expect(body.error).toBe("İşlem tamamlanamadı.");
    spy.mockRestore();
  });
});

// Cron ortak kapısı (v6.205) — sözleşme: Doctorium deploy'unda no-op · sırsız 503 · yanlış Bearer 401 ·
// doğru Bearer geçer. Bakım nöbeti altı cron'a bölünürken korkuluk tek dosyaya alındı; bu test onu
// kilitler (bir rota kapıyı atlarsa cron-routes.test yakalar, kapının kendisi burada).
import { describe, it, expect, afterEach, vi } from "vitest";
import { cronGate, errText } from "@/lib/cron-guard";

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/x", { headers: auth ? { authorization: auth } : {} });

describe("cronGate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("Doctorium deploy'unda (BRAND_MODE=doctorium) no-op — sır kontrolüne hiç gelmez", async () => {
    vi.stubEnv("BRAND_MODE", "doctorium");
    vi.stubEnv("CRON_SECRET", "");
    const res = cronGate(req(), "x");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ skipped: expect.stringContaining("AURA projesinde koşar") });
  });

  it("CRON_SECRET yoksa 503 — cron devre dışı, site etkilenmez", async () => {
    vi.stubEnv("BRAND_MODE", "");
    vi.stubEnv("CRON_SECRET", "");
    const res = cronGate(req("Bearer herhangi"), "x");
    expect(res!.status).toBe(503);
  });

  it("yanlış / eksik Bearer 401", () => {
    vi.stubEnv("BRAND_MODE", "");
    vi.stubEnv("CRON_SECRET", "gizli-sir");
    expect(cronGate(req(), "x")!.status).toBe(401);
    expect(cronGate(req("Bearer yanlis"), "x")!.status).toBe(401);
    expect(cronGate(req("Bearer gizli-sir-uzun"), "x")!.status).toBe(401); // uzunluk farkı da 401 (timingSafeEqual atmaz)
    expect(cronGate(req("gizli-sir"), "x")!.status).toBe(401); // şema yok
  });

  it("doğru Bearer → null (rota devam eder)", () => {
    vi.stubEnv("BRAND_MODE", "");
    vi.stubEnv("CRON_SECRET", "gizli-sir");
    expect(cronGate(req("Bearer gizli-sir"), "x")).toBeNull();
  });
});

describe("errText", () => {
  it("Error mesajını 120 karaktere kırpar; Error değilse fallback", () => {
    expect(errText(new Error("x".repeat(200)), "f")).toHaveLength(120);
    expect(errText("string hata", "fallback")).toBe("fallback");
  });
});

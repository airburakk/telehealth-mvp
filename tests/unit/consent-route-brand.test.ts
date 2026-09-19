// /api/consent — MARKA SINIRI (👤 bulgu 2026-09-19): Doctorium deploy'unda AURA kapsamları (GENERAL_KVKK / AURA_TERMS /
// STAFF_KVKK) KAYDEDİLMEZ (400); yalnız "doctorium" (01+02) ve "resign" geçer. AURA deploy'unda davranış değişmez.
// IS_DOCTORIUM_DEPLOY modül yüklenirken çözülür → alerts.test deseni: stubEnv + resetModules + DİNAMİK import (mock'lar da
// yeniden yüklenir ki route ile test aynı örneğe baksın).
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(), createSession: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn(async () => ({ doctorId: "d1" })) } } }));
vi.mock("@/lib/doctorium-consent", () => ({
  gateConsentVersion: vi.fn(async () => 4),
  recordDoctoriumConsent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/aura-consent", () => ({
  recordPatientConsent: vi.fn(async () => undefined),
  recordStaffConsent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/doctor-activation", () => ({ refreshActivation: vi.fn(async () => undefined) }));

const DOCTOR = { id: "u1", email: "d@air.test", name: "Dr", role: "DOCTOR", cv: 0, sv: 0 };

async function load(brandMode: string) {
  vi.resetModules();
  vi.stubEnv("BRAND_MODE", brandMode);
  const auth = await import("@/lib/auth");
  vi.mocked(auth.getCurrentUser).mockResolvedValue(DOCTOR as never);
  const aura = await import("@/lib/aura-consent");
  const dc = await import("@/lib/doctorium-consent");
  const route = await import("@/app/api/consent/route");
  // vi.mock fabrika örnekleri resetModules sonrasında da AYNI kalır (sayaçlar testler arasında birikir) → her yüklemede sıfırla.
  const out = {
    route,
    staff: vi.mocked(aura.recordStaffConsent),
    patient: vi.mocked(aura.recordPatientConsent),
    doct: vi.mocked(dc.recordDoctoriumConsent),
    createSession: vi.mocked(auth.createSession),
  };
  for (const m of [out.staff, out.patient, out.doct, out.createSession]) m.mockClear();
  return out;
}
const post = (body: unknown) =>
  new Request("http://localhost/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("/api/consent — Doctorium deploy'unda AURA onamı alınmaz", () => {
  it("BRAND_MODE=doctorium: kind=staff → 400; personel kaydı YAZILMAZ, oturum yeniden imzalanmaz", async () => {
    const { route, staff, createSession } = await load("doctorium");
    const res = await route.POST(post({ kind: "staff", lang: "tr" }));
    expect(res.status).toBe(400);
    expect(staff).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("BRAND_MODE=doctorium: kind yok (varsayılan general) ve kind=general de 400", async () => {
    const { route, staff, patient } = await load("doctorium");
    expect((await route.POST(post({}))).status).toBe(400);
    expect((await route.POST(post({ kind: "general", lang: "en" }))).status).toBe(400);
    expect(staff).not.toHaveBeenCalled();
    expect(patient).not.toHaveBeenCalled();
  });

  it("BRAND_MODE=doctorium: kind=doctorium → 200 + Doctorium kaydı; kind=resign → 200, kayıt yok, cv yeniden hesaplanır", async () => {
    const { route, doct, staff, createSession } = await load("doctorium");
    const a = await route.POST(post({ kind: "doctorium" }));
    expect(a.status).toBe(200);
    expect(doct).toHaveBeenCalledTimes(1);
    const b = await route.POST(post({ kind: "resign" }));
    expect(b.status).toBe(200);
    expect(await b.json()).toEqual({ ok: true, cv: 4 });
    expect(doct).toHaveBeenCalledTimes(1);
    expect(staff).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it("AURA deploy'unda (BRAND_MODE yok) kind=staff → 200 + personel kaydı — regresyon nöbeti", async () => {
    const { route, staff, createSession } = await load("");
    const res = await route.POST(post({ kind: "staff", lang: "tr" }));
    expect(res.status).toBe(200);
    expect(staff).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});

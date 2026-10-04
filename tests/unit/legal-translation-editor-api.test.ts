// Birim — 7-C editörü uç sözleşmesi (2026-10-03): POST /api/admin/hukuki-ceviri approve + `edits` → lib'e dize haritası olarak
// geçer; dizi/dize olmayan değer 400 (lib çağrılmaz); edits yokken eski sözleşme (edits null). legal-approval-admin.test mock deseni.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: "9.9.9.9", userAgent: "vitest" }) }));
vi.mock("@/lib/legal-approval", () => {
  class LegalApprovalConflict extends Error {}
  return {
    LegalApprovalConflict,
    approveLegalTranslation: vi.fn(async () => ({ approvedAt: new Date("2026-10-03T10:00:00Z") })),
    revokeLegalTranslation: vi.fn(async () => {}),
    generateLegalTranslation: vi.fn(),
  };
});

import { POST } from "@/app/api/admin/hukuki-ceviri/route";
import { getCurrentUser } from "@/lib/auth";
import { approveLegalTranslation } from "@/lib/legal-approval";
import type { SessionUser } from "@/lib/session";

const ADMIN = { id: "a1", email: "admin@air.test", name: "Yönetici", role: "ADMIN" } as unknown as SessionUser;
const call = (body: unknown) => POST(new Request("http://x/api/admin/hukuki-ceviri", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const H = "a".repeat(64);

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(ADMIN);
  vi.mocked(approveLegalTranslation).mockClear();
});

describe("POST approve + edits", () => {
  it("edits haritası lib'e aynen geçer (dil kodu → Türkçe ad, not dahil)", async () => {
    const res = await call({ slug: "aydinlatma", lang: "ru", action: "approve", textHash: H, note: "düzeltildi", edits: { "Türkçe birim": "Yeni çeviri" } });
    expect(res.status).toBe(200);
    expect(vi.mocked(approveLegalTranslation)).toHaveBeenCalledWith(expect.objectContaining({ slug: "aydinlatma", lang: "Rusça", textHash: H, note: "düzeltildi", edits: { "Türkçe birim": "Yeni çeviri" } }));
  });

  it("edits dizi ya da dize olmayan değer → 400, lib çağrılmaz", async () => {
    expect((await call({ slug: "aydinlatma", lang: "ru", action: "approve", textHash: H, edits: ["x"] })).status).toBe(400);
    expect((await call({ slug: "aydinlatma", lang: "ru", action: "approve", textHash: H, edits: { a: 1 } })).status).toBe(400);
    expect(vi.mocked(approveLegalTranslation)).not.toHaveBeenCalled();
  });

  it("edits yokken eski sözleşme: edits null olarak geçer", async () => {
    expect((await call({ slug: "aydinlatma", lang: "ru", action: "approve", textHash: H })).status).toBe(200);
    expect(vi.mocked(approveLegalTranslation)).toHaveBeenCalledWith(expect.objectContaining({ edits: null }));
  });

  it("ADMIN dışı → 401, lib çağrılmaz", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...ADMIN, role: "DOCTOR" } as unknown as SessionUser);
    expect((await call({ slug: "aydinlatma", lang: "ru", action: "approve", textHash: H, edits: { a: "b" } })).status).toBe(401);
    expect(vi.mocked(approveLegalTranslation)).not.toHaveBeenCalled();
  });
});

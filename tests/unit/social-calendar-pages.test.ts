// İçerik takvimi — sayfa kapıları (v6.328, 2026-10-06; hafıza [[sayfa-modulu-kapi-testleri]]): oturumsuz → /giris?next, ADMIN dışı → /, ve kapı
// geçilmeden veri sorgusu HİÇ çağrılmaz. Yuva ayrıntısı: bulunamayan yuva → notFound; bilinmeyen rubrik → notFound. Hafta sayfası: geçersiz
// `hafta` parametresi bu haftaya düşer (URL kurcalanması kırmaz) ve GET yazma yapmaz (listWeek yalnız okur).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}), reqMeta: () => ({ ip: null, userAgent: null }) }));
vi.mock("@/lib/social-calendar/plan", () => ({
  listWeek: vi.fn(async () => []),
  getItem: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
// İstemci bileşenleri sayfa kapısı testinin konusu değil: boş kabuklar.
vi.mock("@/app/admin/icerik-takvimi/SlotEditor", () => ({ SlotEditor: () => null }));
vi.mock("@/app/admin/icerik-takvimi/OpenSlotButton", () => ({ OpenSlotButton: () => null }));

import ContentCalendarPage from "@/app/admin/icerik-takvimi/page";
import ContentSlotPage from "@/app/admin/icerik-takvimi/[id]/page";
import { getCurrentUser } from "@/lib/auth";
import { getItem, listWeek } from "@/lib/social-calendar/plan";
import type { SessionUser } from "@/lib/session";

const asUser = (u: Partial<SessionUser> | null) => vi.mocked(getCurrentUser).mockResolvedValue((u as SessionUser) ?? null);
const ADMIN: Partial<SessionUser> = { id: "a1", email: "admin@air.test", name: "Yönetici", role: "ADMIN" };
const week = (hafta?: string) => ContentCalendarPage({ searchParams: Promise.resolve(hafta === undefined ? {} : { hafta }) });
const slot = (id = "p1") => ContentSlotPage({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(listWeek).mockClear();
  vi.mocked(getItem).mockReset();
});

describe("/admin/icerik-takvimi — hafta sayfası kapısı", () => {
  it("oturumsuz → /giris?next; ADMIN dışı → /; sorgu HİÇ çağrılmaz", async () => {
    asUser(null);
    await expect(week()).rejects.toThrow("REDIRECT:/giris?next=/admin/icerik-takvimi");
    for (const role of ["PATIENT", "DOCTOR", "COORDINATOR", "ETHICS", "PARTNER"]) {
      asUser({ ...ADMIN, role } as Partial<SessionUser>);
      await expect(week()).rejects.toThrow("REDIRECT:/");
    }
    expect(listWeek).not.toHaveBeenCalled();
  });
  it("ADMIN: haftanın Pazartesi'siyle listWeek çağrılır; verilen gün hangi haftadaysa o hafta", async () => {
    asUser(ADMIN);
    await week("2026-10-07"); // Çarşamba → 5 Ekim haftası
    expect(listWeek).toHaveBeenLastCalledWith("2026-10-05");
    await week("2026-10-11"); // Pazar → aynı hafta
    expect(listWeek).toHaveBeenLastCalledWith("2026-10-05");
  });
  it("geçersiz `hafta` parametresi bu haftaya düşer (hata vermez)", async () => {
    asUser(ADMIN);
    await week("saçma-değer");
    await week("2026-02-30");
    const [a] = vi.mocked(listWeek).mock.calls[0] ?? [];
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(vi.mocked(listWeek).mock.calls).toHaveLength(2);
    expect(vi.mocked(listWeek).mock.calls[1]?.[0]).toBe(a);
  });
});

describe("/admin/icerik-takvimi/[id] — yuva sayfası kapısı", () => {
  it("oturumsuz → /giris?next=<yuva>; ADMIN dışı → /; yuva sorgusu HİÇ çağrılmaz", async () => {
    asUser(null);
    await expect(slot("p9")).rejects.toThrow("REDIRECT:/giris?next=/admin/icerik-takvimi/p9");
    asUser({ ...ADMIN, role: "DOCTOR" } as Partial<SessionUser>);
    await expect(slot("p9")).rejects.toThrow("REDIRECT:/");
    expect(getItem).not.toHaveBeenCalled();
  });
  it("olmayan yuva → notFound; bilinmeyen rubrik anahtarı → notFound", async () => {
    asUser(ADMIN);
    vi.mocked(getItem).mockResolvedValueOnce(null);
    await expect(slot()).rejects.toThrow("NOT_FOUND");
    vi.mocked(getItem).mockResolvedValueOnce({ id: "p1", seriesKey: "yok", slotDay: "2026-10-07", status: "DRAFT" } as never);
    await expect(slot()).rejects.toThrow("NOT_FOUND");
  });
  it("geçerli yuva: sayfa çizilir (istisna yok)", async () => {
    asUser(ADMIN);
    vi.mocked(getItem).mockResolvedValueOnce({ id: "p1", seriesKey: "karar-masasi", slotDay: "2026-10-07", status: "DRAFT", sourceIds: [], candidates: [], payload: null, editorNote: "", attestIdentity: false, gateReport: null, approvedAt: null, approvedBy: null, approvedIntact: false, version: "v" } as never);
    await expect(slot()).resolves.toBeTruthy();
  });
});

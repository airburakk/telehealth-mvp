// Birim — Finans hakediş sözlüğü (kontrol raporu 2026-09-17 D05, v6.281) + doktor/finans sayfa modülü.
// Sözleşme: hakediş KULVAR + ücret sözleşmesiyle (tele = net · ücretsiz = 0 ayrı sayaç · turizm = mutabakat);
// simülasyon etiketi büyük toplamın yanında; dökümde HASTA ADI YOK (decryptField hiç çağrılmaz; kimliksiz işlem no).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { consultationLane, consultationEarning, laneSummary, teleNet, txRef, CONSULT_FEE, COMMISSION } from "@/lib/finance";
import { formatUSD } from "@/lib/pricing";

const tele = { case: { freeCare: false, tourismPlan: null } };
const free = { case: { freeCare: true, tourismPlan: null } };
const tourism = { case: { freeCare: false, tourismPlan: "{}" } };

describe("lib/finance sözlüğü", () => {
  it("kulvar türetimi hasta tarafıyla aynı öncelikte: turizm > ücretsiz > tele", () => {
    expect(consultationLane(tele)).toBe("telehealth");
    expect(consultationLane(free)).toBe("free");
    expect(consultationLane(tourism)).toBe("tourism");
    expect(consultationLane({ case: { freeCare: true, tourismPlan: "{}" } })).toBe("tourism");
  });
  it("hakediş: tele = brüt − komisyon; ücretsiz ve turizm 0", () => {
    expect(teleNet()).toBe(CONSULT_FEE * (1 - COMMISSION));
    expect(consultationEarning(tele)).toBe(120);
    expect(consultationEarning(free)).toBe(0);
    expect(consultationEarning(tourism)).toBe(0);
  });
  it("laneSummary sayar ve yalnız tele toplar", () => {
    expect(laneSummary([tele, tele, free, tourism])).toEqual({ tele: 2, free: 1, tourism: 1, teleTotal: 240 });
    expect(laneSummary([])).toEqual({ tele: 0, free: 0, tourism: 0, teleTotal: 0 });
  });
  it("txRef kimliksiz işlem numarası — son 6 karakter, büyük harf", () => {
    expect(txRef("clx123abcdef")).toBe("#ABCDEF");
  });
});

// ── Sayfa modülü ──
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    doctor: { findUnique: vi.fn() },
    consultation: { findMany: vi.fn(async () => []) },
    secondOpinionCase: { findMany: vi.fn(async () => []) },
    booking: { findMany: vi.fn(async () => []) },
    consultationRequest: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/doctor-activation", () => ({ hasClinicalAccess: () => true }));
vi.mock("@/lib/consultation-requests", () => ({ answeredStatsForDoctor: vi.fn(async () => ({ count: 0, totalEarned: 0 })) }));
vi.mock("@/lib/crypto", () => ({ decryptField: vi.fn((v: string | null) => v) }));

import FinansPage from "@/app/doktor/finans/page";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import type { SessionUser } from "@/lib/session";

// JSX ağacını metne indir — aynı modüldeki fonksiyon bileşenler (LaneCard/NetRozet) çağrılarak açılır; dış bileşenler
// (next/link, lucide) hook/ref istediğinden yalnız children gezilir.
function textOf(node: unknown): string {
  return rawText(node).replace(/\s+/g, " ");
}
function rawText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(rawText).join(" ");
  if (typeof node === "object" && "props" in (node as object)) {
    const el = node as { type: unknown; props: Record<string, unknown> };
    if (typeof el.type === "function" && (el.type as { name?: string }).name !== "Link") {
      try { return rawText((el.type as (p: unknown) => unknown)(el.props)); } catch { /* dış bileşen */ }
    }
    return rawText(el.props.children);
  }
  return "";
}

describe("doktor/finans sayfası (D05)", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", role: "DOCTOR" } as SessionUser);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", doctorId: "d1" } as never);
    vi.mocked(db.doctor.findUnique).mockResolvedValue({ id: "d1", activatedAt: new Date() } as never);
    vi.mocked(decryptField).mockClear();
  });

  it("ücretsiz ve turizm görüşmeleri ücretli listeye girmez; toplam yalnız tele; hasta adı çözülmez", async () => {
    const d = new Date("2026-09-01T10:00:00Z");
    vi.mocked(db.consultation.findMany).mockResolvedValue([
      { id: "cons-tele-aaaaaa", startedAt: d, endedAt: d, case: { freeCare: false, tourismPlan: null } },
      { id: "cons-tele-bbbbbb", startedAt: d, endedAt: d, case: { freeCare: false, tourismPlan: null } },
      { id: "cons-free-cccccc", startedAt: d, endedAt: d, case: { freeCare: true, tourismPlan: null } },
      { id: "cons-tour-dddddd", startedAt: d, endedAt: d, case: { freeCare: false, tourismPlan: "{}" } },
    ] as never);
    const text = textOf(await FinansPage());
    expect(text).toContain("2 ücretli görüşme");
    expect(text).toContain("1 ücretsiz görüşme");
    expect(text).toContain("gönüllü katkı");
    expect(text).toContain("1 tamamlanan sağlık turizmi görüşmesi");
    expect(text).toContain("Simülasyon");
    expect(text).toContain(formatUSD(240)); // genel toplam = 2 × 120 (ücretsiz/turizm 0)
    expect(text).toContain("#AAAAAA"); // kimliksiz işlem no
    expect(text).not.toContain("#CCCCCC"); // ücretsiz görüşme ücretli dökümde YOK
    expect(decryptField).not.toHaveBeenCalled(); // hasta adı hiç çözülmez (K02/K03)
    // Sorgu klinik/kimlik alanı çekmez
    const q = vi.mocked(db.consultation.findMany).mock.calls[0][0] as { select: { case: { select: Record<string, boolean> } } };
    expect(Object.keys(q.select.case.select).sort()).toEqual(["freeCare", "tourismPlan"]);
  });

  it("görüşme yoksa sıfır ve boş-durum metinleri", async () => {
    vi.mocked(db.consultation.findMany).mockResolvedValue([] as never);
    const text = textOf(await FinansPage());
    expect(text).toContain("Henüz tamamlanmış ücretli görüşme yok.");
    expect(text).toContain("0 ücretsiz görüşme");
  });
});

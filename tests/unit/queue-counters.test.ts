// Birim — kuyruk sayaç sözlüğü (kontrol raporu 2026-09-17 D02, v6.281): "Acil" tamamlanmış vakayı SAYMAZ, dört sayacın
// kapsamı açıklanmıştır ve stat tıklamasının URL'e yazdığı filtre sayımla AYNI where'i üretir (tek kaynak).
import { describe, it, expect } from "vitest";
import {
  QUEUE_COUNTER_KEYS, QUEUE_COUNTER_FILTERS, queueCounterWhere, statusFilterWhere, queueFilterWhere, scopedWhere,
  isQueuePseudoStatus, OPEN_CASE_STATUSES, ACTION_PENDING_STATUSES, doctorQueueScope,
} from "@/lib/case-access";
import { QUEUE_COUNTERS } from "@/lib/doctor-home";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
function matches(where: Where, row: Row): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === "AND") { if (!(v as Where[]).every((w) => matches(w, row))) return false; continue; }
    if (k === "OR") { if (!(v as Where[]).some((w) => matches(w, row))) return false; continue; }
    const val = row[k];
    if (v !== null && typeof v === "object") {
      const cond = v as Record<string, unknown>;
      if ("in" in cond && !(cond.in as unknown[]).includes(val)) return false;
      if ("gte" in cond && !((val as number) >= (cond.gte as number))) return false;
    } else if (val !== v) return false;
  }
  return true;
}
const scope = doctorQueueScope({ doctorId: "me", branch: "Kardiyoloji", verified: true });
const row = (o: Partial<Row>): Row => ({ id: "c", doctorId: "me", branch: "Kardiyoloji", status: "NEW", deletionLockedAt: null, urgency: 3, ...o });
const count = (key: (typeof QUEUE_COUNTER_KEYS)[number], rows: Row[]) => rows.filter((r) => matches(queueCounterWhere(scope, key) as Where, r)).length;

describe("sayaç kapsamları (D02)", () => {
  const rows = [
    row({ id: "new-urgent", status: "NEW", urgency: 5 }),
    row({ id: "review", status: "IN_REVIEW", urgency: 2 }),
    row({ id: "consult-urgent", status: "IN_CONSULT", urgency: 4 }),
    row({ id: "done-urgent", status: "DONE", urgency: 5 }),
    row({ id: "done", status: "DONE", urgency: 1 }),
    row({ id: "locked", status: "NEW", urgency: 5, deletionLockedAt: new Date() }),
  ];
  it("aktif acil: aciliyet ≥4 VE açık durum — tamamlanmış vaka sayılmaz (raporun bulgusu)", () => {
    expect(count("urgent", rows)).toBe(2); // new-urgent + consult-urgent; done-urgent HAYIR; locked kapsam dışı
  });
  it("açık: NEW/IN_REVIEW/IN_CONSULT; arşiv: DONE; işlem bekleyen: NEW + IN_REVIEW", () => {
    expect(count("open", rows)).toBe(3);
    expect(count("archive", rows)).toBe(2);
    expect(count("pending", rows)).toBe(2);
    expect(OPEN_CASE_STATUSES).toEqual(["NEW", "IN_REVIEW", "IN_CONSULT"]);
    expect(ACTION_PENDING_STATUSES).toEqual(["NEW", "IN_REVIEW"]);
  });
  it("sayaç where'i = stat tıklamasının filtresi (aynı QUEUE_COUNTER_FILTERS girdisi) — sayı ile liste uyuşur", () => {
    for (const key of QUEUE_COUNTER_KEYS) {
      expect(queueCounterWhere(scope, key)).toEqual(scopedWhere(scope, QUEUE_COUNTER_FILTERS[key]));
    }
    expect(QUEUE_COUNTER_FILTERS.urgent).toEqual({ status: "open", urgent: true }); // acil tıklaması açık kümeyle birlikte
  });
  it("kapsam dışı satır hiçbir sayaca girmez (silme kilidi)", () => {
    for (const key of QUEUE_COUNTER_KEYS) expect(count(key, [row({ deletionLockedAt: new Date(), urgency: 5 })])).toBe(0);
  });
});

describe("sözde durum filtreleri", () => {
  it("open/pending `in` listesine çözülür; gerçek durum aynen; isQueuePseudoStatus yalnız ikisini tanır", () => {
    expect(statusFilterWhere("open")).toEqual({ status: { in: ["NEW", "IN_REVIEW", "IN_CONSULT"] } });
    expect(statusFilterWhere("pending")).toEqual({ status: { in: ["NEW", "IN_REVIEW"] } });
    expect(statusFilterWhere("DONE")).toEqual({ status: "DONE" });
    expect(isQueuePseudoStatus("open")).toBe(true);
    expect(isQueuePseudoStatus("NEW")).toBe(false);
    expect(isQueuePseudoStatus("all")).toBe(false);
  });
  it("queueFilterWhere sözde durumu ve aciliyeti birlikte uygular", () => {
    const w = queueFilterWhere({ status: "open", urgent: true }) as Where;
    expect(matches(w, row({ status: "IN_CONSULT", urgency: 4 }))).toBe(true);
    expect(matches(w, row({ status: "DONE", urgency: 5 }))).toBe(false);
    expect(matches(w, row({ status: "NEW", urgency: 3 }))).toBe(false);
  });
});

describe("sözlük (lib/doctor-home QUEUE_COUNTERS)", () => {
  it("her sayacın etiketi VE kapsam alt yazısı var; eski belirsiz adlar yok", () => {
    for (const key of QUEUE_COUNTER_KEYS) {
      expect(QUEUE_COUNTERS[key].label.length).toBeGreaterThan(2);
      expect(QUEUE_COUNTERS[key].caption.length).toBeGreaterThan(8);
    }
    const labels = QUEUE_COUNTER_KEYS.map((k) => QUEUE_COUNTERS[k].label);
    expect(labels).not.toContain("Toplam vaka");
    expect(labels).not.toContain("Bekleyen");
    expect(labels).not.toContain("Acil (4-5)");
    expect(QUEUE_COUNTERS.urgent.caption).toMatch(/açık/i);
  });
});

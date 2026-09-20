// Birim — lib/patient-cases (kontrol raporu 2026-09-17 K09-hasta / H11, v6.281): grup bölümlemesi (her dosya TEK
// grupta), keyset imleç (createdAt+id; silinen imleç satırından bağımsız), iki-kaynak birleştirme ve "sıradaki adım"
// sözlüğünün tüm durumları kapsaması.
import { describe, it, expect } from "vitest";
import {
  PATIENT_CASE_GROUPS, PATIENT_PAGE_SIZE, CASE_GROUP_STATUSES, SO_ACTION_STATUSES, SO_ONGOING_STATUSES, SO_DONE_STATUSES,
  caseGroupWhere, soGroupWhere, encodeCursor, decodeCursor, keysetWhere, mergeKeysetPage, parsePatientListParams,
  caseNextStep, soNextStep, NEXT_STEP_TEXTS, GROUP_LABELS,
} from "@/lib/patient-cases";
import { CASE_STATUS } from "@/lib/constants";
import { SO_STATUSES } from "@/lib/second-opinion";
import { BRANCHES } from "@/lib/triage";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
// AND/OR · eşitlik · in · gte/lt (Date) · requests some/none (satırda `requests: {status}[]`)
function matches(where: Where, row: Row): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === "AND") { if (!(v as Where[]).every((w) => matches(w, row))) return false; continue; }
    if (k === "OR") { if (!(v as Where[]).some((w) => matches(w, row))) return false; continue; }
    if (k === "requests") {
      const reqs = (row.requests as { status: string }[]) ?? [];
      const c = v as { some?: Where; none?: Where };
      if (c.some && !reqs.some((r) => matches(c.some!, r as Row))) return false;
      if (c.none && reqs.some((r) => matches(c.none!, r as Row))) return false;
      continue;
    }
    const val = row[k];
    // Date → sayı, string → kendisi (id imleci sözlük sırasıyla karşılaştırılır)
    const cmp = (x: unknown): number | string => (x instanceof Date ? x.getTime() : (x as number | string));
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const cond = v as Record<string, unknown>;
      if ("in" in cond && !(cond.in as unknown[]).includes(val)) return false;
      if ("gte" in cond && !(cmp(val) >= cmp(cond.gte))) return false;
      if ("lt" in cond && !(cmp(val) < cmp(cond.lt))) return false;
    } else if (v instanceof Date) { if (cmp(val) !== v.getTime()) return false; }
    else if (val !== v) return false;
  }
  return true;
}
const groupOf = (kind: "case" | "so", row: Row) =>
  PATIENT_CASE_GROUPS.filter((g) =>
    matches((kind === "case" ? caseGroupWhere(g, {}, { userId: "p" }) : soGroupWhere(g, {}, { patientId: "p" })) as Where, row),
  );

describe("grup bölümlemesi — her dosya TEK grupta", () => {
  it("genel vaka: DOCS_PENDING → işlem gerekiyor · NEW/IN_REVIEW/IN_CONSULT → devam · DONE → tamamlanan", () => {
    const base = { userId: "p", createdAt: new Date() };
    expect(groupOf("case", { ...base, status: "DOCS_PENDING" })).toEqual(["aksiyon"]);
    for (const s of ["NEW", "IN_REVIEW", "IN_CONSULT"]) expect(groupOf("case", { ...base, status: s })).toEqual(["devam"]);
    expect(groupOf("case", { ...base, status: "DONE" })).toEqual(["tamam"]);
    expect(groupOf("case", { ...base, status: "NEW", userId: "başkası" })).toEqual([]); // sahiplik korunur
    // sözlük CASE_STATUS'un TÜM anahtarlarını kapsar (yeni durum eklenirse burada patlar)
    const covered = new Set(Object.values(CASE_GROUP_STATUSES).flat());
    for (const s of Object.keys(CASE_STATUS)) expect(covered.has(s), `status=${s}`).toBe(true);
  });
  it("ikinci görüş: her SO durumu tam olarak bir grupta; bekleyen talep her durumu 'işlem gerekiyor'a çeker", () => {
    const base = { patientId: "p", createdAt: new Date(), requests: [] as { status: string }[] };
    for (const s of SO_STATUSES) expect(groupOf("so", { ...base, status: s }), `status=${s}`).toHaveLength(1);
    expect(groupOf("so", { ...base, status: "ASSIGNED", requests: [{ status: "PENDING" }] })).toEqual(["aksiyon"]);
    expect(groupOf("so", { ...base, status: "OPINION_DELIVERED", requests: [{ status: "PENDING" }] })).toEqual(["aksiyon"]);
    expect(groupOf("so", { ...base, status: "ASSIGNED", requests: [{ status: "FULFILLED" }] })).toEqual(["devam"]);
    const all = [...SO_ACTION_STATUSES, ...SO_ONGOING_STATUSES, ...SO_DONE_STATUSES].sort();
    expect(all).toEqual([...SO_STATUSES].sort());
  });
  it("branş ve tarih filtresi: Case ETİKET, SO ANAHTAR; gün sınırları dahil", () => {
    const b = BRANCHES[0];
    const f = { branch: b.key, from: "2026-09-01", to: "2026-09-02" };
    const cw = caseGroupWhere("devam", f, { userId: "p" }) as Where;
    const sw = soGroupWhere("devam", f, { patientId: "p" }) as Where;
    const at = (iso: string) => new Date(iso);
    expect(matches(cw, { userId: "p", status: "NEW", branch: b.label, createdAt: at("2026-09-02T23:59:00Z") })).toBe(true);
    expect(matches(cw, { userId: "p", status: "NEW", branch: b.label, createdAt: at("2026-09-03T00:00:00Z") })).toBe(false);
    expect(matches(cw, { userId: "p", status: "NEW", branch: "Başka", createdAt: at("2026-09-01T12:00:00Z") })).toBe(false);
    expect(matches(sw, { patientId: "p", status: "ASSIGNED", branch: b.key, requests: [], createdAt: at("2026-09-01T00:00:00Z") })).toBe(true);
    expect(matches(sw, { patientId: "p", status: "ASSIGNED", branch: b.key, requests: [], createdAt: at("2026-08-31T23:59:59Z") })).toBe(false);
  });
});

describe("keyset imleç + birleştirme", () => {
  it("imleç gidiş-dönüş; bozuk imleç yok sayılır (ilk sayfa)", () => {
    const c = encodeCursor({ createdAt: new Date("2026-09-20T10:00:00.000Z"), id: "clx_abc-1" });
    expect(decodeCursor(c)).toEqual({ createdAt: new Date("2026-09-20T10:00:00.000Z"), id: "clx_abc-1" });
    expect(decodeCursor("saçma")).toBeNull();
    expect(decodeCursor("0.abc")).toBeNull();
    expect(keysetWhere(undefined)).toEqual({});
    expect(keysetWhere("x.y")).toEqual({});
  });
  it("(createdAt, id) < imleç — aynı zaman damgasında id eşitlik bozucu; imleç satırının varlığı gerekmez", () => {
    const t = new Date("2026-09-20T10:00:00.000Z");
    const w = keysetWhere(encodeCursor({ createdAt: t, id: "m" })) as Where;
    expect(matches(w, { createdAt: new Date(t.getTime() - 1), id: "z" })).toBe(true);
    expect(matches(w, { createdAt: t, id: "a" })).toBe(true); // aynı an, küçük id
    expect(matches(w, { createdAt: t, id: "m" })).toBe(false); // imlecin kendisi
    expect(matches(w, { createdAt: t, id: "z" })).toBe(false);
    expect(matches(w, { createdAt: new Date(t.getTime() + 1), id: "a" })).toBe(false);
  });
  it("iki kaynak birleşir, sayfa kesilir, sonraki imleç sayfanın son satırıdır", () => {
    const mk = (prefix: string, n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}${String(i).padStart(3, "0")}`, createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, 0, offset + i * 2)).toISOString() }));
    const a = mk("a", PATIENT_PAGE_SIZE + 1, 0); // çift ms
    const b = mk("b", PATIENT_PAGE_SIZE + 1, 1); // tek ms → iç içe geçer
    const page = mergeKeysetPage(a, b);
    expect(page.items).toHaveLength(PATIENT_PAGE_SIZE);
    for (let i = 1; i < page.items.length; i++) {
      expect(page.items[i - 1].createdAt >= page.items[i].createdAt).toBe(true); // azalan
    }
    expect(page.nextCursor).toBe(encodeCursor(page.items[PATIENT_PAGE_SIZE - 1]));
    // sonraki sayfa: imlecin altındakiler — ilk sayfadakilerle kesişmez
    const w = keysetWhere(page.nextCursor!) as Where;
    const rest = [...a, ...b].filter((r) => matches(w, { createdAt: new Date(r.createdAt), id: r.id }));
    expect(rest.map((r) => r.id).some((id) => page.items.some((p) => p.id === id))).toBe(false);
    expect(rest.length).toBe(a.length + b.length - PATIENT_PAGE_SIZE);
    // küçük küme: sonraki yok
    expect(mergeKeysetPage(a.slice(0, 3), [], 20).nextCursor).toBeNull();
  });
});

describe("URL parametreleri + sıradaki adım sözlüğü", () => {
  it("parsePatientListParams geçersizi sessizce yok sayar", () => {
    expect(parsePatientListParams({ grup: "tamam", branch: BRANCHES[0].key, from: "2026-09-01", to: "31-09-2026", cursor: "abc" }))
      .toEqual({ group: "tamam", branch: BRANCHES[0].key, from: "2026-09-01", to: undefined, cursor: undefined });
    expect(parsePatientListParams({ grup: "yok", branch: "Uzaylı" })).toEqual({ group: undefined, branch: undefined, from: undefined, to: undefined, cursor: undefined });
    const c = encodeCursor({ createdAt: new Date(), id: "id1" });
    expect(parsePatientListParams({ cursor: [c] }).cursor).toBe(c);
  });
  it("her vaka ve SO durumu için tek cümle var; takip açıkken DONE farklı; bekleyen talep öne geçer", () => {
    for (const s of Object.keys(CASE_STATUS)) expect(caseNextStep(s, { hasRecovery: false }).length, s).toBeGreaterThan(10);
    expect(caseNextStep("DONE", { hasRecovery: true })).not.toBe(caseNextStep("DONE", { hasRecovery: false }));
    for (const s of SO_STATUSES) expect(soNextStep(s, false).length, s).toBeGreaterThan(10);
    expect(soNextStep("ASSIGNED", true)).toMatch(/yükleyin/);
    expect(soNextStep("AWAITING_DOCUMENTS", true)).toBe(soNextStep("AWAITING_DOCUMENTS", false)); // zaten aksiyon durumu
    // useT listesi sözlüğün tamamını taşır (çeviri eksik kalmasın)
    for (const s of Object.keys(CASE_STATUS)) expect(NEXT_STEP_TEXTS).toContain(caseNextStep(s, { hasRecovery: false }));
    expect(NEXT_STEP_TEXTS).toContain(caseNextStep("DONE", { hasRecovery: true }));
    for (const s of SO_STATUSES) expect(NEXT_STEP_TEXTS).toContain(soNextStep(s, false));
    expect(Object.keys(GROUP_LABELS).sort()).toEqual([...PATIENT_CASE_GROUPS].sort());
  });
});

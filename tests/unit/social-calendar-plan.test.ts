// İçerik takvimi — servis katmanı (plan.ts) sözleşmeleri (v6.328, 2026-10-06). DB sahte: bellek içi tek tablo; `updateMany` GERÇEK CAS
// semantiğini taşır (where.updatedAt + where.status.in) — iyimser eşzamanlılık ve "onay düşer" davranışları burada kilitlenir.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  seriesKey: string;
  slotDay: string;
  status: string;
  sourceKind: string | null;
  sourceIds: string;
  candidates: string;
  payload: string | null;
  attestIdentity: boolean;
  gateReport: string | null;
  approvedAt: Date | null;
  approvedById: string | null;
  approvedBy: string | null;
  approvedHash: string | null;
  publishedRefs: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  articles: [] as { id: string; externalId: string; title: string; summary: string; publishedAt: Date }[],
  audits: [] as { action: string; resourceId: string; detail: string | null }[],
  clock: 0,
  seq: 0,
  race: false, // true → upsert, rakip INSERT kazanmış gibi P2002 fırlatır
  boom: false, // true → upsert genel hata fırlatır
}));

const rows = () => state.rows as Row[];
const tick = () => new Date(Date.UTC(2026, 9, 6, 12, 0, 0) + ++state.clock * 1000);

function matches(r: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === "id" && v && typeof v === "object" && "not" in (v as object)) {
      if (r.id === (v as { not: string }).not) return false;
    } else if (k === "id") {
      if (r.id !== v) return false;
    } else if (k === "status" && v && typeof v === "object") {
      const inn = (v as { in?: string[] }).in;
      if (inn && !inn.includes(r.status)) return false;
    } else if (k === "slotDay" && v && typeof v === "object") {
      const inn = (v as { in?: string[] }).in;
      if (inn && !inn.includes(r.slotDay)) return false;
    } else if (k === "updatedAt") {
      if ((v as Date).getTime() !== r.updatedAt.getTime()) return false;
    } else if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
  }
  return true;
}

vi.mock("@/lib/db", () => ({
  db: {
    contentPlanItem: {
      findMany: async (a: { where?: Record<string, unknown> } = {}) => rows().filter((r) => matches(r, a.where)),
      findUnique: async (a: { where: { id?: string; seriesKey_slotDay?: { seriesKey: string; slotDay: string } } }) => {
        const k = a.where.seriesKey_slotDay;
        return rows().find((r) => (k ? r.seriesKey === k.seriesKey && r.slotDay === k.slotDay : r.id === a.where.id)) ?? null;
      },
      upsert: async (a: { where: { seriesKey_slotDay: { seriesKey: string; slotDay: string } }; create: Partial<Row> }) => {
        const k = a.where.seriesKey_slotDay;
        const insert = () => {
          const t = tick();
          const row: Row = {
            id: `row${++state.seq}`, seriesKey: k.seriesKey, slotDay: k.slotDay, status: "PLANNED", sourceKind: null, sourceIds: "[]", candidates: "[]",
            payload: null, attestIdentity: false, gateReport: null, approvedAt: null, approvedById: null, approvedBy: null, approvedHash: null,
            publishedRefs: null, publishedAt: null, createdAt: t, updatedAt: t, ...a.create,
          };
          state.rows.push(row);
          return row;
        };
        if (state.boom) throw new Error("bağlantı koptu");
        if (state.race) {
          state.race = false;
          insert(); // rakip istek aynı yuvayı bizden hemen önce ekledi
          throw Object.assign(new Error("Unique constraint failed on the fields: (`seriesKey`,`slotDay`)"), { code: "P2002" });
        }
        return rows().find((r) => r.seriesKey === k.seriesKey && r.slotDay === k.slotDay) ?? insert();
      },
      update: async (a: { where: { id: string }; data: Partial<Row> }) => {
        const r = rows().find((x) => x.id === a.where.id);
        if (!r) throw new Error("yok");
        Object.assign(r, a.data, { updatedAt: tick() });
        return r;
      },
      updateMany: async (a: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const hit = rows().filter((r) => matches(r, a.where));
        for (const r of hit) Object.assign(r, a.data, { updatedAt: tick() });
        return { count: hit.length };
      },
    },
    newsArticle: {
      findMany: async (a: { where?: { id?: { in?: string[]; notIn?: string[] } } } = {}) => {
        const w = a.where?.id;
        return state.articles.filter((x) => (!w?.in || w.in.includes(x.id)) && (!w?.notIn || !w.notIn.includes(x.id)));
      },
      findFirst: async (a: { where: { id: string } }) => state.articles.find((x) => x.id === a.where.id) ?? null,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  recordAccess: async (i: { action: string; resourceId: string; detail?: string | null }) => {
    state.audits.push({ action: i.action, resourceId: i.resourceId, detail: i.detail ?? null });
  },
}));

import type { SessionUser } from "@/lib/session";
import {
  PlanConflict,
  PlanError,
  PlanGateError,
  approve,
  computeCandidates,
  getItem,
  isApprovedIntact,
  listWeek,
  openSlot,
  pickSource,
  restore,
  saveDraft,
  skip,
  unapprove,
} from "@/lib/social-calendar/plan";
import { skeletonPayload } from "@/lib/social-calendar/skeleton";
import { parsePayload, type PlanPayload } from "@/lib/social-calendar/payload";
import { seriesByKey } from "@/lib/social-calendar/series";

const ADMIN = { id: "u1", email: "a@x.test", name: "Yönetici", role: "ADMIN" } as unknown as SessionUser;
const A = { actor: ADMIN, ip: "1.1.1.1", userAgent: "t" };

const FILLER = "Davacı vekili; müvekkilinin tedavi sürecinde ortaya çıkan sonuçlar nedeniyle zarar gördüğünü ileri sürerek tazminat talep etmiştir. ".repeat(10);
const KARAR_TEXT = `3. Hukuk Dairesi  2025/4384 E. , 2026/1817 K.

I. DAVA
${FILLER}
V. TEMYİZ
A. Temyiz Sebepleri
${FILLER}
B. Değerlendirme ve Gerekçe
Uyuşmazlık, davalı doktorun vekalet sözleşmesinden kaynaklanan özen borcuna aykırı davranıldığı iddiasına dayalı maddi ve manevi tazminat istemine ilişkindir.
Hükme esas alınan raporların birbiriyle uyumlu ve denetime elverişli olduğu, komplikasyonun her türlü özene rağmen gelişebildiği anlaşıldığından davacı vekilinin temyiz itirazlarının reddi ile usul ve kanuna uygun olan kararın onanmasına karar verilmiştir.
VI. KARAR
Açıklanan sebeplerle;
Temyiz olunan kararın ONANMASINA,
13.05.2026 tarihinde oy birliğiyle karar verildi.`;

const NOTE = "1) Aydınlatma belgesi her işlemde dosyada bulunmalı\n2) Komplikasyon kaydı hasta dosyasına işlenmeli\n3) Bilgilendirme işlemden önce ve anlaşılır yapılmalı";

const WEDNESDAY = "2026-10-07";

function article(id: string, esas: string, text = KARAR_TEXT) {
  return { id, externalId: `e${id}`, title: `Yargıtay 3. Hukuk Dairesi · E. ${esas}, K. 2026/1817`, summary: text, publishedAt: new Date("2026-05-13T00:00:00Z") };
}

beforeEach(() => {
  state.rows = [];
  state.articles = [article("a1", "2025/4384"), article("a2", "2025/5000")];
  state.audits = [];
  state.clock = 0;
  state.seq = 0;
  state.race = false;
  state.boom = false;
});

/** Çarşamba yuvasını açar, a1 kararını seçer → DRAFT. */
async function draftedKarar() {
  const slot = await openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY });
  return pickSource({ id: slot.id, articleId: "a1", expectedVersion: slot.version, ...A });
}

describe("openSlot / listWeek", () => {
  it("yuva açılır, idempotenttir; rubrik yanlış günde açılamaz; GET (listWeek) yazmaz", async () => {
    const a = await openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY });
    const b = await openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY });
    expect(b.id).toBe(a.id);
    expect(a.status).toBe("PLANNED");
    expect(rows()).toHaveLength(1);
    await expect(openSlot({ seriesKey: "karar-masasi", slotDay: "2026-10-08" })).rejects.toThrow(/bu günde/);
    await expect(openSlot({ seriesKey: "yok", slotDay: WEDNESDAY })).rejects.toBeInstanceOf(PlanError);
    const before = rows().length;
    const week = await listWeek("2026-10-05");
    expect(rows()).toHaveLength(before);
    expect(week.map((w) => [w.series.key, w.slotDay, w.item?.status ?? null])).toEqual([
      ["etkinlik-radari", "2026-10-05", null],
      ["karar-masasi", "2026-10-07", "PLANNED"],
      ["ogrenci-kosesi", "2026-10-09", null],
    ]);
    await expect(listWeek("bozuk")).rejects.toBeInstanceOf(PlanError);
  });
  it("eşzamanlı çift istek (rakip INSERT kazandı → P2002): 500 DEĞİL, kazanan satır döner ve tek satır kalır", async () => {
    state.race = true;
    const v = await openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY });
    expect(v.status).toBe("PLANNED");
    expect(rows()).toHaveLength(1);
    expect((await openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY })).id).toBe(v.id);
  });
  it("P2002 DIŞI veritabanı hatası yutulmaz (aynen fırlar)", async () => {
    state.boom = true;
    await expect(openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY })).rejects.toThrow("bağlantı koptu");
    expect(rows()).toHaveLength(0);
  });
});

describe("computeCandidates / pickSource", () => {
  it("aday üretir ve saklar; başka yuvada kullanılan karar bir sonraki yuvaya ÖNERİLMEZ", async () => {
    const slot = await openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY });
    const { view, stats } = await computeCandidates({ id: slot.id });
    expect(view.candidates.map((c) => c.id).sort()).toEqual(["a1", "a2"]);
    expect(stats.eligible).toBe(2);
    await pickSource({ id: slot.id, articleId: "a1", expectedVersion: view.version, ...A });
    const next = await openSlot({ seriesKey: "karar-masasi", slotDay: "2026-10-14" });
    const r = await computeCandidates({ id: next.id });
    expect(r.view.candidates.map((c) => c.id)).toEqual(["a2"]);
  });
  it("üreticisiz rubrikte aday/kaynak seçimi reddedilir", async () => {
    const e = await openSlot({ seriesKey: "etkinlik-radari", slotDay: "2026-10-05" });
    await expect(computeCandidates({ id: e.id })).rejects.toThrow(/aday üretici henüz yok/);
    await expect(pickSource({ id: e.id, articleId: "a1", expectedVersion: e.version, ...A })).rejects.toThrow(/henüz yok/);
  });
  it("kaynak seçilince 7 slaytlık taslak + DRAFT; çıkarım boş; kimlik onayı sıfır", async () => {
    const v = await draftedKarar();
    expect(v.status).toBe("DRAFT");
    expect(v.sourceIds).toEqual(["a1"]);
    expect(v.payload?.slides.map((s) => s.role)).toEqual(["kapak", "uyusmazlik", "mahkeme", "gerekce", "sonuc", "cikarim", "kaynak"]);
    expect(v.editorNote).toBe("");
    expect(v.attestIdentity).toBe(false);
  });
  it("uygun olmayan / olmayan / başka yuvada kullanılan karar reddedilir", async () => {
    state.articles.push(article("bad", "2025/1", "kısa metin"));
    const slot = await openSlot({ seriesKey: "karar-masasi", slotDay: WEDNESDAY });
    await expect(pickSource({ id: slot.id, articleId: "bad", expectedVersion: slot.version, ...A })).rejects.toThrow(/uygun değil/);
    await expect(pickSource({ id: slot.id, articleId: "yok", expectedVersion: slot.version, ...A })).rejects.toThrow(/bulunamadı/);
    const first = await pickSource({ id: slot.id, articleId: "a1", expectedVersion: slot.version, ...A });
    const other = await openSlot({ seriesKey: "karar-masasi", slotDay: "2026-10-14" });
    await expect(pickSource({ id: other.id, articleId: "a1", expectedVersion: other.version, ...A })).rejects.toThrow(/başka bir yuvada/);
    expect(first.status).toBe("DRAFT");
  });
});

describe("iyimser eşzamanlılık (CAS)", () => {
  it("eski sürümle yazma PlanConflict (409) verir ve veriyi DEĞİŞTİRMEZ", async () => {
    const v = await draftedKarar();
    const saved = await saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, ...A });
    expect(saved.version).not.toBe(v.version);
    await expect(saveDraft({ id: v.id, expectedVersion: v.version, editorNote: "başka sekmeden eski yazı bu", ...A })).rejects.toBeInstanceOf(PlanConflict);
    expect((await getItem(v.id))?.editorNote).toContain("Aydınlatma belgesi");
  });
  it("sürüm eksik/bozuksa 400", async () => {
    const v = await draftedKarar();
    await expect(saveDraft({ id: v.id, expectedVersion: "bozuk", editorNote: NOTE, ...A })).rejects.toThrow(/Sürüm bilgisi/);
  });
  it("olmayan yuva 404", async () => {
    await expect(approve({ id: "yok", expectedVersion: new Date().toISOString(), ...A })).rejects.toMatchObject({ status: 404 });
  });
});

describe("saveDraft", () => {
  it("çıkarım metni cikarim slaytına yansır; gate raporu saklanır; değişmeyen kayıt no-op", async () => {
    const v = await draftedKarar();
    const s1 = await saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, attestIdentity: true, ...A });
    expect(s1.payload?.slides.find((s) => s.role === "cikarim")?.bullets).toHaveLength(3);
    expect(s1.attestIdentity).toBe(true);
    expect(s1.gateReport?.ok).toBe(true);
    const s2 = await saveDraft({ id: v.id, expectedVersion: s1.version, editorNote: NOTE, attestIdentity: true, ...A });
    expect(s2.version).toBe(s1.version);
  });
  it("slayt düzenlemesi `auto` bayrağını düşürür; geçersiz yük 400", async () => {
    const v = await draftedKarar();
    const payload = JSON.parse(JSON.stringify(v.payload)) as PlanPayload;
    payload.slides[0] = { role: "kapak", title: "Yeni kapak başlığı", body: payload.slides[0]!.body };
    const s = await saveDraft({ id: v.id, expectedVersion: v.version, payload, ...A });
    expect(s.payload?.slides[0]?.title).toBe("Yeni kapak başlığı");
    expect(s.payload?.slides[0]?.auto).toBeUndefined();
    await expect(saveDraft({ id: v.id, expectedVersion: s.version, payload: { slides: "x" }, ...A })).rejects.toBeInstanceOf(PlanError);
  });
  it("üreticisiz rubrikte ilk kayıt boş iskeletten başlar", async () => {
    const e = await openSlot({ seriesKey: "etkinlik-radari", slotDay: "2026-10-05" });
    const s = await saveDraft({ id: e.id, expectedVersion: e.version, editorNote: undefined, attestIdentity: undefined, payload: { ...skeletonPayload(seriesByKey("etkinlik-radari")!), caption: "Haftanın etkinlikleri burada." }, ...A });
    expect(s.status).toBe("DRAFT");
    expect(s.payload?.slides.map((x) => x.role)).toEqual(["kapak", "genel", "genel", "genel", "kaynak"]);
  });
});

describe("approve", () => {
  async function ready() {
    const v = await draftedKarar();
    return saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, attestIdentity: true, ...A });
  }
  it("kapılar geçerse APPROVED + mühür (hash, kişi, tarih) + audit; içerik bütünlüğü doğrulanır", async () => {
    const r = await ready();
    const a = await approve({ id: r.id, expectedVersion: r.version, ...A });
    expect(a.status).toBe("APPROVED");
    expect(a.approvedBy).toBe("Yönetici");
    expect(a.approvedAt).toBeTruthy();
    expect(a.approvedIntact).toBe(true);
    expect(state.audits.map((x) => x.action)).toEqual(["CONTENT_PLAN_APPROVE"]);
    expect(state.audits[0]?.detail).toMatch(/^karar-masasi·2026-10-07·[0-9a-f]{12}$/);
  });
  it("çıkarım yazılmadan onay YOK (422 + rapor); hiçbir şey değişmez, audit yok", async () => {
    const v = await draftedKarar();
    const err = await approve({ id: v.id, expectedVersion: v.version, ...A }).catch((e) => e);
    expect(err).toBeInstanceOf(PlanGateError);
    expect((err as PlanGateError).status).toBe(422);
    expect((err as PlanGateError).report.gates.filter((g) => !g.ok).map((g) => g.id).sort()).toEqual(["cikarim", "kimlik-onay"]);
    expect((await getItem(v.id))?.status).toBe("DRAFT");
    expect(state.audits).toEqual([]);
  });
  it("kimlik onay kutusu işaretlenmeden onay YOK", async () => {
    const v = await draftedKarar();
    const s = await saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, ...A });
    const err = await approve({ id: v.id, expectedVersion: s.version, ...A }).catch((e) => e);
    expect(err).toBeInstanceOf(PlanGateError);
    expect((err as PlanGateError).report.gates.filter((g) => !g.ok).map((g) => g.id)).toEqual(["kimlik-onay"]);
  });
  it("kaynak metni sonradan değişirse (alıntı artık aynen yok) onay YOK — kapı TAZE metinle koşar", async () => {
    const r = await ready();
    const src = state.articles.find((x) => x.id === "a1")!;
    src.summary = src.summary.replace("vekalet sözleşmesinden", "vekâlet sözleşmesinden değil");
    const err = await approve({ id: r.id, expectedVersion: r.version, ...A }).catch((e) => e);
    expect(err).toBeInstanceOf(PlanGateError);
    expect((err as PlanGateError).report.gates.find((g) => g.id === "alinti")?.ok).toBe(false);
  });
  it("yalnız DRAFT onaylanabilir; çift onay 409", async () => {
    const r = await ready();
    const a = await approve({ id: r.id, expectedVersion: r.version, ...A });
    await expect(approve({ id: r.id, expectedVersion: a.version, ...A })).rejects.toMatchObject({ status: 409 });
    const planned = await openSlot({ seriesKey: "karar-masasi", slotDay: "2026-10-14" });
    await expect(approve({ id: planned.id, expectedVersion: planned.version, ...A })).rejects.toMatchObject({ status: 409 });
  });
});

describe("onayın düşmesi", () => {
  async function approved() {
    const v = await draftedKarar();
    const r = await saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, attestIdentity: true, ...A });
    return approve({ id: r.id, expectedVersion: r.version, ...A });
  }
  it("onaylı içerik DÜZENLENİNCE DRAFT'a iner, mühür temizlenir, UNAPPROVE audit'lenir", async () => {
    const a = await approved();
    const s = await saveDraft({ id: a.id, expectedVersion: a.version, editorNote: `${NOTE}\n4) Dördüncü madde de eklendi`, ...A });
    expect(s.status).toBe("DRAFT");
    expect(s.approvedAt).toBeNull();
    expect(s.approvedBy).toBeNull();
    expect(s.approvedIntact).toBe(false);
    expect(state.audits.map((x) => x.action)).toEqual(["CONTENT_PLAN_APPROVE", "CONTENT_PLAN_UNAPPROVE"]);
    expect(state.audits[1]?.detail).toContain("içerik değişti");
  });
  it("kaynak değişince de onay düşer ve editör notu SIFIRLANIR", async () => {
    const a = await approved();
    const p = await pickSource({ id: a.id, articleId: "a2", expectedVersion: a.version, ...A });
    expect(p.status).toBe("DRAFT");
    expect(p.editorNote).toBe("");
    expect(p.attestIdentity).toBe(false);
    expect(state.audits.at(-1)?.detail).toContain("kaynak değişti");
  });
  it("elle geri alma: APPROVED → DRAFT + audit; onaysızda 409", async () => {
    const a = await approved();
    const u = await unapprove({ id: a.id, expectedVersion: a.version, ...A });
    expect(u.status).toBe("DRAFT");
    expect(state.audits.at(-1)?.action).toBe("CONTENT_PLAN_UNAPPROVE");
    await expect(unapprove({ id: a.id, expectedVersion: u.version, ...A })).rejects.toMatchObject({ status: 409 });
  });
  it("isApprovedIntact: kayıtlı hash ile içerik uyuşmazsa false (yayın hattı yayınlamaz)", async () => {
    const a = await approved();
    const row = rows().find((r) => r.id === a.id)!;
    expect(isApprovedIntact(row)).toBe(true);
    const p = parsePayload(row.payload)!;
    p.caption += " (sessizce değiştirildi)";
    row.payload = JSON.stringify(p);
    expect(isApprovedIntact(row)).toBe(false);
    expect(isApprovedIntact({ ...row, status: "DRAFT" })).toBe(false);
  });
});

describe("skip / restore", () => {
  it("atla → SKIPPED (onaylıysa onay düşer, audit); geri al → taslak varsa DRAFT yoksa PLANNED; taslak atlama sırasında KALIR", async () => {
    const empty = await openSlot({ seriesKey: "etkinlik-radari", slotDay: "2026-10-05" });
    const sk0 = await skip({ id: empty.id, expectedVersion: empty.version, ...A });
    expect(sk0.status).toBe("SKIPPED");
    expect((await restore({ id: empty.id, expectedVersion: sk0.version, ...A })).status).toBe("PLANNED");

    const v = await draftedKarar();
    const r = await saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, attestIdentity: true, ...A });
    const a = await approve({ id: r.id, expectedVersion: r.version, ...A });
    const sk = await skip({ id: a.id, expectedVersion: a.version, ...A });
    expect(sk.status).toBe("SKIPPED");
    expect(sk.approvedAt).toBeNull();
    expect(sk.payload).not.toBeNull();
    expect(state.audits.at(-1)).toMatchObject({ action: "CONTENT_PLAN_SKIP" });
    expect(state.audits.at(-1)?.detail).toContain("onay düştü");
    const back = await restore({ id: sk.id, expectedVersion: sk.version, ...A });
    expect(back.status).toBe("DRAFT");
    await expect(restore({ id: sk.id, expectedVersion: back.version, ...A })).rejects.toMatchObject({ status: 409 });
  });
  it("atlanmış yuvada düzenleme/kaynak seçimi/aday 409", async () => {
    const v = await draftedKarar();
    const sk = await skip({ id: v.id, expectedVersion: v.version, ...A });
    await expect(saveDraft({ id: v.id, expectedVersion: sk.version, editorNote: NOTE, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(pickSource({ id: v.id, articleId: "a2", expectedVersion: sk.version, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(computeCandidates({ id: v.id })).rejects.toMatchObject({ status: 409 });
  });
});

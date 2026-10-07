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
  audits: [] as { action: string; resourceId: string; detail: string | null; actor: unknown }[],
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
  recordAccess: async (i: { action: string; resourceId: string; detail?: string | null; actor?: unknown }) => {
    state.audits.push({ action: i.action, resourceId: i.resourceId, detail: i.detail ?? null, actor: i.actor ?? null });
  },
}));

import type { SessionUser } from "@/lib/session";
import {
  PlanConflict,
  PlanError,
  PlanGateError,
  approve,
  claimForPublish,
  computeCandidates,
  dueForDay,
  getItem,
  isApprovedIntact,
  listWeek,
  markPublishFailed,
  markPublished,
  openSlot,
  pickSource,
  restore,
  retryPublish,
  saveDraft,
  skip,
  unapprove,
} from "@/lib/social-calendar/plan";
import { skeletonPayload } from "@/lib/social-calendar/skeleton";
import { parsePayload, type PlanPayload } from "@/lib/social-calendar/payload";
import { renderRequestBody } from "@/lib/social-calendar/render-client";
import { seriesByKey } from "@/lib/social-calendar/series";

const ADMIN = { id: "u1", email: "a@x.test", name: "Yönetici", role: "ADMIN" } as unknown as SessionUser;
const A = { actor: ADMIN, ip: "1.1.1.1", userAgent: "t" };
/** Makine (kart/n8n) çağrısı: oturumsuz → actor null, denetim/etiket "otomasyon". */
const M = { actor: null, ip: "9.9.9.9", userAgent: "kart" };

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

describe("yayın durumu (v6.332)", () => {
  async function approved() {
    const v = await draftedKarar();
    const r = await saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, attestIdentity: true, ...A });
    return approve({ id: r.id, expectedVersion: r.version, ...A });
  }
  const IG = [{ channel: "instagram", url: "https://www.instagram.com/p/ABC/" }];

  it("elle yayınlandı: APPROVED → PUBLISHED; kanal/bağlantı/işaretleyen/zaman kaydedilir; audit'e KANAL adı yazılır (bağlantı değil)", async () => {
    const a = await approved();
    const p = await markPublished({ id: a.id, expectedVersion: a.version, channels: [...IG, { channel: "linkedin" }], ...A });
    expect(p.status).toBe("PUBLISHED");
    expect(p.publishedAt).toBeTruthy();
    expect(p.publication).toMatchObject({ v: 1, manual: true, by: "Yönetici", channels: [{ channel: "instagram", url: "https://www.instagram.com/p/ABC/" }, { channel: "linkedin" }] });
    expect(p.approvedBy).toBe("Yönetici"); // kim onayladı bilgisi yayından sonra da KALIR
    expect(state.audits.at(-1)).toMatchObject({ action: "CONTENT_PLAN_PUBLISH", detail: "karar-masasi·2026-10-07·elle·instagram,linkedin" });
    expect(JSON.stringify(state.audits)).not.toContain("instagram.com");
  });

  it("yayınlanmış içerik TERMİNALDİR: düzenlenemez, kaynak değişmez, onay kaldırılamaz, atlanamaz, tekrar yayınlanamaz", async () => {
    const a = await approved();
    const p = await markPublished({ id: a.id, expectedVersion: a.version, channels: IG, ...A });
    await expect(saveDraft({ id: a.id, expectedVersion: p.version, editorNote: `${NOTE}\n4) ek`, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(pickSource({ id: a.id, articleId: "a2", expectedVersion: p.version, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(unapprove({ id: a.id, expectedVersion: p.version, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(skip({ id: a.id, expectedVersion: p.version, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(markPublished({ id: a.id, expectedVersion: p.version, channels: IG, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(retryPublish({ id: a.id, expectedVersion: p.version, ...A })).rejects.toMatchObject({ status: 409 });
    expect((await getItem(a.id))?.status).toBe("PUBLISHED");
  });

  it("yalnız ONAYLI içerik işaretlenir: taslak ve planlı yuva 409, audit yazılmaz", async () => {
    const draft = await draftedKarar();
    await expect(markPublished({ id: draft.id, expectedVersion: draft.version, channels: IG, ...A })).rejects.toMatchObject({ status: 409 });
    const planned = await openSlot({ seriesKey: "karar-masasi", slotDay: "2026-10-14" });
    await expect(markPublished({ id: planned.id, expectedVersion: planned.version, channels: IG, ...A })).rejects.toMatchObject({ status: 409 });
    expect(state.audits).toEqual([]);
  });

  it("kanal doğrulaması: boş/bilinmeyen/tekrarlı kanal ve https dışı bağlantı 400 — durum ve audit DEĞİŞMEZ", async () => {
    const a = await approved();
    for (const channels of [[], undefined, [{ channel: "tiktok" }], [{ channel: "x" }, { channel: "x" }], [{ channel: "x", url: "http://x.com/1" }], [{ channel: "x", url: "javascript:alert(1)" }]]) {
      await expect(markPublished({ id: a.id, expectedVersion: a.version, channels, ...A })).rejects.toMatchObject({ status: 400 });
    }
    expect((await getItem(a.id))?.status).toBe("APPROVED");
    expect(state.audits.map((x) => x.action)).toEqual(["CONTENT_PLAN_APPROVE"]);
  });

  it("iyimser eşzamanlılık: eski sürüm PlanConflict, eksik/bozuk sürüm 400; veri değişmez", async () => {
    const a = await approved();
    await computeCandidates({ id: a.id }); // updatedAt ilerler (başka sekme gibi)
    await expect(markPublished({ id: a.id, expectedVersion: a.version, channels: IG, ...A })).rejects.toBeInstanceOf(PlanConflict);
    await expect(markPublished({ id: a.id, expectedVersion: "bozuk", channels: IG, ...A })).rejects.toThrow(/Sürüm bilgisi/);
    expect((await getItem(a.id))?.status).toBe("APPROVED");
  });

  it("ONAY MÜHRÜ bozulmuşsa (içerik onaydan sonra değişmiş) yayınlandı işareti REDDEDİLİR — 'yayınlanan = onaylanan'", async () => {
    const a = await approved();
    const row = rows().find((r) => r.id === a.id)!;
    const p = parsePayload(row.payload)!;
    p.caption += " (sessizce değiştirildi)";
    row.payload = JSON.stringify(p);
    const cur = (await getItem(a.id))!;
    expect(cur.approvedIntact).toBe(false);
    await expect(markPublished({ id: a.id, expectedVersion: cur.version, channels: IG, ...A })).rejects.toThrow(/mührüyle eşleşmiyor/);
    expect((await getItem(a.id))?.status).toBe("APPROVED");
    expect(state.audits.map((x) => x.action)).toEqual(["CONTENT_PLAN_APPROVE"]);
  });

  it("yayın hatası: ALINMIŞ içerik → FAILED (mühür korunur, hata notu temiz ve kısa) → yeniden dene → APPROVED → yayınlandı; audit zinciri sırayla", async () => {
    const a = await approved();
    const c = await claimForPublish({ gun: WEDNESDAY, bugun: WEDNESDAY, ...M });
    const f = await markPublishFailed({ id: a.id, expectedVersion: c.items[0]!.version, error: `Instagram 400:\n\t  kapsayıcı ${"x".repeat(500)}`, ...M });
    expect(f.status).toBe("FAILED");
    expect(f.publication).toMatchObject({ manual: false, channels: [] });
    expect(f.publication?.error?.length).toBeLessThanOrEqual(300);
    expect(f.publication?.error).not.toMatch(/[\n\t]/);
    expect(f.publication?.error?.startsWith("Instagram 400: kapsayıcı")).toBe(true);
    expect(f.approvedAt).not.toBeNull(); // mühür korunur → yeniden denenebilir
    expect(f.publishedAt).toBeNull();
    await expect(saveDraft({ id: a.id, expectedVersion: f.version, editorNote: `${NOTE}\n4) ek`, ...A })).rejects.toMatchObject({ status: 409 }); // FAILED'da içerik düzenlenemez

    const r = await retryPublish({ id: a.id, expectedVersion: f.version, ...A });
    expect(r.status).toBe("APPROVED");
    expect(r.publication).toBeNull();
    expect(r.approvedIntact).toBe(true);
    const p = await markPublished({ id: a.id, expectedVersion: r.version, channels: IG, ...A });
    expect(p.status).toBe("PUBLISHED");
    expect(state.audits.map((x) => x.action)).toEqual(["CONTENT_PLAN_APPROVE", "CONTENT_PLAN_CLAIM", "CONTENT_PLAN_PUBLISH_FAIL", "CONTENT_PLAN_RETRY", "CONTENT_PLAN_PUBLISH"]);
  });

  it("FAILED: yalnız ALINMIŞ içerik FAILED'a düşer (taslak/onaylı-alınmamış 409); boş hata metni 'Bilinmeyen hata'; atlanınca eski hata notu GİDER", async () => {
    const draft = await draftedKarar();
    await expect(markPublishFailed({ id: draft.id, expectedVersion: draft.version, error: "x", ...M })).rejects.toMatchObject({ status: 409 });
    const r = await saveDraft({ id: draft.id, expectedVersion: draft.version, editorNote: NOTE, attestIdentity: true, ...A });
    const a = await approve({ id: r.id, expectedVersion: r.version, ...A });
    await expect(markPublishFailed({ id: a.id, expectedVersion: a.version, error: "x", ...M })).rejects.toMatchObject({ status: 409 }); // onaylı ama ALINMAMIŞ → hata bildirilemez
    const c = await claimForPublish({ gun: WEDNESDAY, bugun: WEDNESDAY, ...M });
    const f = await markPublishFailed({ id: a.id, expectedVersion: c.items[0]!.version, error: " \n\t ", ...M });
    expect(f.publication?.error).toBe("Bilinmeyen hata");
    const sk = await skip({ id: a.id, expectedVersion: f.version, ...A });
    expect(sk.status).toBe("SKIPPED");
    expect(sk.publication).toBeNull();
    expect((await restore({ id: a.id, expectedVersion: sk.version, ...A })).publication).toBeNull();
  });

  it("yeniden deneme yalnız FAILED/YAYINLANIYOR'da (APPROVED'da 409); mühür bozuksa reddedilir", async () => {
    const a = await approved();
    await expect(retryPublish({ id: a.id, expectedVersion: a.version, ...A })).rejects.toMatchObject({ status: 409 }); // APPROVED'da denenecek hata/takılı yayın yok
    const c = await claimForPublish({ gun: WEDNESDAY, bugun: WEDNESDAY, ...M });
    const f = await markPublishFailed({ id: a.id, expectedVersion: c.items[0]!.version, error: "ağ hatası", ...M });
    const row = rows().find((x) => x.id === a.id)!;
    const p = parsePayload(row.payload)!;
    p.caption += " (değiştirildi)";
    row.payload = JSON.stringify(p);
    const cur = (await getItem(a.id))!;
    expect(cur.version).toBe(f.version);
    await expect(retryPublish({ id: a.id, expectedVersion: cur.version, ...A })).rejects.toThrow(/mührüyle eşleşmiyor/);
    expect((await getItem(a.id))?.status).toBe("FAILED");
  });

  it("bozuk publishedRefs sayfayı ÇÖKERTMEZ (publication null)", async () => {
    const a = await approved();
    rows().find((x) => x.id === a.id)!.publishedRefs = "{bozuk";
    expect((await getItem(a.id))?.publication).toBeNull();
  });
});

describe("makine yüzeyi — YAYINLANIYOR kilidi (v6.334)", () => {
  async function approved() {
    const v = await draftedKarar();
    const r = await saveDraft({ id: v.id, expectedVersion: v.version, editorNote: NOTE, attestIdentity: true, ...A });
    return approve({ id: r.id, expectedVersion: r.version, ...A });
  }
  const IG = [{ channel: "instagram", url: "https://www.instagram.com/p/X/" }];
  const al = () => claimForPublish({ gun: WEDNESDAY, bugun: WEDNESDAY, ...M });

  it("dueForDay YALNIZ OKUR: o günün ONAYLI + mührü sağlam içeriği verilir; hiçbir satır/audit değişmez; diğer gün ve durumlar dışarıda", async () => {
    const a = await approved();
    const other = await openSlot({ seriesKey: "karar-masasi", slotDay: "2026-10-14" }); // PLANNED
    const before = JSON.stringify(rows());
    const snap = await dueForDay(WEDNESDAY);
    expect(snap.items.map((i) => i.id)).toEqual([a.id]);
    expect(snap.items[0]).toMatchObject({ seriesKey: "karar-masasi", slotDay: WEDNESDAY, version: a.version, approvedHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(snap.items[0]!.payload.slides).toHaveLength(7);
    // kart gövdesi ÖNİZLEMEYLE AYNI işlevden (v6.335): yalnız görsele yarayan alanlar — auto/meta/altyazı/kaynak GİTMEZ; kart rubrik adını/şablonunu KENDİ bilmez
    const rd = snap.items[0]!.render;
    expect(rd).toMatchObject({ templateKey: "karar-masasi", seriesName: "Karar masası", slotDay: WEDNESDAY });
    expect(rd.slides).toHaveLength(7);
    expect(rd.slides.map((x) => x.role)).toEqual(snap.items[0]!.payload.slides.map((x) => x.role));
    for (const x of rd.slides) expect(Object.keys(x).sort()).toEqual(["body", "bullets", "quote", "role", "title"]);
    expect(rd).toEqual(renderRequestBody(seriesByKey("karar-masasi")!, snap.items[0]!.payload, WEDNESDAY));
    expect(snap.atlanan).toEqual([]);
    expect(snap.slotlar).toEqual([{ id: a.id, seriesKey: "karar-masasi", status: "APPROVED" }]);
    expect(JSON.stringify(rows())).toBe(before);
    expect(state.audits.map((x) => x.action)).toEqual(["CONTENT_PLAN_APPROVE"]);
    const next = await dueForDay("2026-10-14");
    expect(next.items).toEqual([]); // PLANNED → yayına hazır değil
    expect(next.slotlar).toEqual([{ id: other.id, seriesKey: "karar-masasi", status: "PLANNED" }]);
    await expect(dueForDay("bozuk")).rejects.toMatchObject({ status: 400 });
  });

  it("onay mührü bozuksa içerik VERİLMEZ (atlanan: muhur-bozuk) ve KİLİTLENMEZ — 'yayınlanan = onaylanan'", async () => {
    const a = await approved();
    const row = rows().find((r) => r.id === a.id)!;
    const p = parsePayload(row.payload)!;
    p.caption += " (sessizce değiştirildi)";
    row.payload = JSON.stringify(p);
    const snap = await dueForDay(WEDNESDAY);
    expect(snap.items).toEqual([]);
    expect(snap.atlanan).toEqual([{ id: a.id, seriesKey: "karar-masasi", neden: "muhur-bozuk" }]);
    expect((await al()).items).toEqual([]);
    expect((await getItem(a.id))?.status).toBe("APPROVED");
  });

  it("al: APPROVED → YAYINLANIYOR; dönen sürüm YENİ; yayın kaydı (alınma anı) yazılır; audit actor=null (otomasyon)", async () => {
    const a = await approved();
    const c = await al();
    expect(c.items).toHaveLength(1);
    expect(c.items[0]!.id).toBe(a.id);
    expect(c.items[0]!.version).not.toBe(a.version);
    expect(c.items[0]!.render).toMatchObject({ templateKey: "karar-masasi", seriesName: "Karar masası", slotDay: WEDNESDAY }); // alınan öğe de kart gövdesini taşır
    const v = (await getItem(a.id))!;
    expect(v.status).toBe("PUBLISHING");
    expect(v.version).toBe(c.items[0]!.version);
    expect(v.publication).toMatchObject({ v: 1, manual: false, channels: [] });
    expect(v.publication?.at).toBeTruthy();
    expect(state.audits.at(-1)).toMatchObject({ action: "CONTENT_PLAN_CLAIM", actor: null, detail: "karar-masasi·2026-10-07·yayın için alındı" });
  });

  it("EN FAZLA BİR KEZ: ikinci koşu alamaz; iki EŞZAMANLI koşudan yalnız biri alır (CAS)", async () => {
    await approved();
    const [x, y] = await Promise.all([al(), al()]);
    expect(x.items.length + y.items.length).toBe(1);
    expect((await al()).items).toEqual([]);
    expect(state.audits.filter((e) => e.action === "CONTENT_PLAN_CLAIM")).toHaveLength(1);
  });

  it("al YALNIZ bugünü alır (yanlış gün parametresi geleceği erken yayına sokmasın); geçersiz gün 400; durum DEĞİŞMEZ", async () => {
    const a = await approved();
    await expect(claimForPublish({ gun: "2026-10-14", bugun: WEDNESDAY, ...M })).rejects.toMatchObject({ status: 400 });
    await expect(claimForPublish({ gun: "bozuk", bugun: WEDNESDAY, ...M })).rejects.toMatchObject({ status: 400 });
    expect((await getItem(a.id))?.status).toBe("APPROVED");
    expect(state.audits.map((x) => x.action)).toEqual(["CONTENT_PLAN_APPROVE"]);
  });

  it("YAYINLANIYOR'da içerik KİLİTLİ: düzenlenemez, kaynak değişmez, onay kaldırılamaz, atlanamaz", async () => {
    const a = await approved();
    const c = await al();
    const ver = c.items[0]!.version;
    await expect(saveDraft({ id: a.id, expectedVersion: ver, editorNote: `${NOTE}\n4) ek`, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(pickSource({ id: a.id, articleId: "a2", expectedVersion: ver, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(unapprove({ id: a.id, expectedVersion: ver, ...A })).rejects.toMatchObject({ status: 409 });
    await expect(skip({ id: a.id, expectedVersion: ver, ...A })).rejects.toMatchObject({ status: 409 });
    expect((await getItem(a.id))?.status).toBe("PUBLISHING");
  });

  it("otomasyon sonucu (ok): YAYINLANDI, by='otomasyon', kısmi başarısızlık kaydedilir; audit actor=null + kanal adları (bağlantı değil)", async () => {
    const a = await approved();
    const c = await al();
    const p = await markPublished({ id: a.id, expectedVersion: c.items[0]!.version, channels: IG, failures: [{ channel: "linkedin", error: "429 oran sınırı" }], manual: false, ...M });
    expect(p.status).toBe("PUBLISHED");
    expect(p.publication).toMatchObject({ manual: false, by: "otomasyon", channels: IG, failures: [{ channel: "linkedin", error: "429 oran sınırı" }] });
    expect(state.audits.at(-1)).toMatchObject({ action: "CONTENT_PLAN_PUBLISH", actor: null, detail: "karar-masasi·2026-10-07·otomatik·instagram·başarısız:linkedin" });
    expect(JSON.stringify(state.audits)).not.toContain("instagram.com");
  });

  it("otomasyon sonucu kuralları: ALMADAN sonuç bildirilemez (409); eski sürüm PlanConflict; aynı kanal hem başarılı hem başarısız 400; geçersiz failures 400", async () => {
    const a = await approved();
    await expect(markPublished({ id: a.id, expectedVersion: a.version, channels: IG, manual: false, ...M })).rejects.toMatchObject({ status: 409 });
    const c = await al();
    await expect(markPublished({ id: a.id, expectedVersion: a.version, channels: IG, manual: false, ...M })).rejects.toBeInstanceOf(PlanConflict); // alma ÖNCESİ sürüm eski
    const ver = c.items[0]!.version;
    await expect(markPublished({ id: a.id, expectedVersion: ver, channels: IG, failures: [{ channel: "instagram", error: "x" }], manual: false, ...M })).rejects.toMatchObject({ status: 400 });
    await expect(markPublished({ id: a.id, expectedVersion: ver, channels: IG, failures: "kötü", manual: false, ...M })).rejects.toMatchObject({ status: 400 });
    expect((await getItem(a.id))?.status).toBe("PUBLISHING");
  });

  it("otomasyon hata bildirimi: YAYINLANIYOR → FAILED; APPROVED'dan (alınmamış) 409", async () => {
    const a = await approved();
    await expect(markPublishFailed({ id: a.id, expectedVersion: a.version, error: "x", ...M })).rejects.toMatchObject({ status: 409 });
    const c = await al();
    const f = await markPublishFailed({ id: a.id, expectedVersion: c.items[0]!.version, error: "Instagram 400", ...M });
    expect(f.status).toBe("FAILED");
    expect(f.publication).toMatchObject({ manual: false, error: "Instagram 400" });
    expect(state.audits.at(-1)).toMatchObject({ action: "CONTENT_PLAN_PUBLISH_FAIL", actor: null });
  });

  it("İNSAN çözümü (a): takılı kilit 'yayınlanmadı' → yeniden dene → APPROVED; sonra yeniden ALINABİLİR", async () => {
    const a = await approved();
    const c = await al();
    const r = await retryPublish({ id: a.id, expectedVersion: c.items[0]!.version, ...A });
    expect(r.status).toBe("APPROVED");
    expect(r.publication).toBeNull();
    expect(r.approvedIntact).toBe(true);
    expect(state.audits.at(-1)).toMatchObject({ action: "CONTENT_PLAN_RETRY", detail: "karar-masasi·2026-10-07·takılı yayın: yayınlanmadı" });
    const again = await al();
    expect(again.items).toHaveLength(1);
    expect((await getItem(a.id))?.status).toBe("PUBLISHING");
  });

  it("İNSAN çözümü (b): takılı kilit 'kanalda var' → elle yayınlandı (manual:true, işaretleyen = yönetici); sonradan gelen otomasyon sonucu 409", async () => {
    const a = await approved();
    const c = await al();
    const p = await markPublished({ id: a.id, expectedVersion: c.items[0]!.version, channels: IG, ...A });
    expect(p.status).toBe("PUBLISHED");
    expect(p.publication).toMatchObject({ manual: true, by: "Yönetici" });
    await expect(markPublished({ id: a.id, expectedVersion: p.version, channels: IG, manual: false, ...M })).rejects.toMatchObject({ status: 409 });
  });

  it("dueForDay yalnız APPROVED'ı 'hazır' sayar: TASLAK · YAYINLANIYOR · YAYIN HATASI · YAYINLANDI yuvası items'a da atlanan'a da GİRMEZ (yalnız slotlar'da durumuyla görünür)", async () => {
    const hazir = async () => {
      const s = await dueForDay(WEDNESDAY);
      return { items: s.items.length, atlanan: s.atlanan.length, durum: s.slotlar.map((x) => x.status) };
    };
    const d = await draftedKarar(); // onay yok → mühür yok: 'muhur-bozuk' DEĞİL, yalnızca hazır değil
    expect(await hazir()).toEqual({ items: 0, atlanan: 0, durum: ["DRAFT"] });
    const r = await saveDraft({ id: d.id, expectedVersion: d.version, editorNote: NOTE, attestIdentity: true, ...A });
    const a = await approve({ id: r.id, expectedVersion: r.version, ...A });
    expect(await hazir()).toEqual({ items: 1, atlanan: 0, durum: ["APPROVED"] });
    const c = await al();
    expect(await hazir()).toEqual({ items: 0, atlanan: 0, durum: ["PUBLISHING"] }); // mühür SAĞLAM olsa da alınmış içerik tekrar sunulmaz
    const f = await markPublishFailed({ id: a.id, expectedVersion: c.items[0]!.version, error: "x", ...M });
    expect(await hazir()).toEqual({ items: 0, atlanan: 0, durum: ["FAILED"] });
    await retryPublish({ id: a.id, expectedVersion: f.version, ...A });
    expect(await hazir()).toEqual({ items: 1, atlanan: 0, durum: ["APPROVED"] }); // insan yeniden denemeye aldı → yine hazır
    const c2 = await al();
    await markPublished({ id: a.id, expectedVersion: c2.items[0]!.version, channels: IG, manual: false, ...M });
    expect(await hazir()).toEqual({ items: 0, atlanan: 0, durum: ["PUBLISHED"] });
  });

  it("bilinmeyen rubrik anahtarlı ONAYLI satır tüm anlık görüntüyü DÜŞÜRMEZ: atlanan:'seri-bilinmiyor'; yayına ALINMAZ", async () => {
    const a = await approved();
    rows().find((r) => r.id === a.id)!.seriesKey = "silinmis-rubrik";
    const snap = await dueForDay(WEDNESDAY);
    expect(snap.items).toEqual([]);
    expect(snap.atlanan).toEqual([{ id: a.id, seriesKey: "silinmis-rubrik", neden: "seri-bilinmiyor" }]);
    expect((await al()).items).toEqual([]);
    expect(rows().find((r) => r.id === a.id)!.status).toBe("APPROVED");
  });
});

// Birim — 7-C çeviri DÜZENLEME editörü (2026-10-03): (1) saf birim çiftleri/harita/değer kuralı (lib/legal-markdown-split);
// (2) düzenlemeli onay (lib/legal-approval): taban = adminin gördüğü metin (otomatik ya da dondurulmuş), hash uyuşmazsa 409 ve
// upsert YOK; düzenlemeler taban haritasına uygulanır (yapı kanonikle aynı, önceki düzeltmeler korunur), düzenlenmiş metin
// dondurulur, audit "düzenlenen N birim"; değer kuralları (boş · satır sonu · sınır · belgede olmayan birim) 400 mesajlarıyla;
// (3) "düzenlenmiş" bayrağı = dondurulmuş hash ≠ otomatik hash (kuyruk + legalApprovalEdited). legal-approval.test mock deseni.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { approvals, dict, peek, get } = vi.hoisted(() => {
  const dict = (lang: string, texts: string[]) => Object.fromEntries(texts.map((t) => [t, `«${lang}» ${t}`]));
  return {
    dict,
    approvals: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    peek: vi.fn(async (lang: string, texts: string[]) => dict(lang, texts)),
    get: vi.fn(async (lang: string, texts: string[]) => dict(lang, texts)),
  };
});
vi.mock("@/lib/db", () => ({ db: { legalTranslationApproval: approvals } }));
vi.mock("@/lib/audit", () => ({ recordAccess: vi.fn(async () => {}) }));
vi.mock("@/lib/i18n", async () => {
  const { LANGUAGES } = await import("@/lib/constants");
  return {
    UI_LANGS: LANGUAGES,
    legalHash: (s: string) => s,
    peekLegalTranslations: (l: string, t: string[]) => peek(l, t),
    getLegalTranslations: (l: string, t: string[]) => get(l, t),
  };
});

import {
  joinLegalMarkdown,
  LEGAL_EDIT_MAX_CHARS,
  legalEditError,
  legalUnitMap,
  legalUnitPairs,
  legalUnits,
  splitLegalMarkdown,
} from "@/lib/legal-markdown-split";
import {
  approveLegalTranslation,
  legalApprovalEdited,
  LegalApprovalConflict,
  legalSourceHash,
  listLegalTranslationQueue,
  normalizeLegalEdits,
} from "@/lib/legal-approval";
import { legalMarkdownUnits } from "@/lib/legal-translate";
import { auraLegalDoc, AURA_LEGAL_VERSION } from "@/lib/aura-legal";
import { recordAccess } from "@/lib/audit";
import { sha256 } from "@/lib/timestamp";
import type { SessionUser } from "@/lib/session";

const ADMIN = { id: "a1", email: "admin@air.test", name: "Yönetici", role: "ADMIN" } as unknown as SessionUser;
const SAMPLE = [
  "# Başlık",
  "",
  "İlk paragraf birinci satır",
  "ikinci satır aynı paragraf.",
  "",
  "- Madde bir",
  "- Madde iki",
  "  devam satırı",
  "",
  "| Sütun A | Sütun B |",
  "|---|---|",
  "| Hücre 1 | — |",
  "",
  "> Alıntı paragrafı",
].join("\n");
const TR_DOC = auraLegalDoc("aydinlatma")!.body.tr;
const ALL_UNITS = legalMarkdownUnits(TR_DOC);
const [U0, U1] = ALL_UNITS.filter((u) => /\p{L}{3,}/u.test(u));
const automatic = (lang = "Rusça") => joinLegalMarkdown(splitLegalMarkdown(TR_DOC), dict(lang, ALL_UNITS));
const ROW = (o: Record<string, unknown> = {}) => ({
  id: "r1", slug: "aydinlatma", lang: "Rusça", version: AURA_LEGAL_VERSION, sourceHash: legalSourceHash("aydinlatma"),
  textHash: "f".repeat(64), markdown: "# Dondurulmuş metin", note: null, approvedAt: new Date("2026-10-03T10:00:00Z"),
  approvedById: "a1", approvedBy: "Yönetici", revokedAt: null, ...o,
});
const lastDetail = () => vi.mocked(recordAccess).mock.calls.at(-1)?.[0].detail ?? "";

beforeEach(() => {
  approvals.findUnique.mockReset().mockResolvedValue(null);
  approvals.findMany.mockReset().mockResolvedValue([]);
  approvals.upsert.mockReset().mockImplementation(async (a: { create: Record<string, unknown> }) => ({ id: "r1", ...a.create }));
  vi.mocked(recordAccess).mockClear();
  peek.mockClear().mockImplementation(async (lang, texts) => dict(lang, texts));
  get.mockClear().mockImplementation(async (lang, texts) => dict(lang, texts));
});

describe("birim çiftleri / harita / değer kuralı (saf)", () => {
  it("TR + aynı yapıdaki çeviri → belge sırasında çiftler; hücreler ayrı tür; boş birim yok", () => {
    const units = legalUnits(splitLegalMarkdown(SAMPLE));
    const translated = joinLegalMarkdown(splitLegalMarkdown(SAMPLE), dict("Rusça", units));
    const pairs = legalUnitPairs(SAMPLE, translated)!;
    expect(pairs.map((p) => p.key)).toEqual(["Başlık", "İlk paragraf birinci satır ikinci satır aynı paragraf.", "Madde bir", "Madde iki devam satırı", "Sütun A", "Sütun B", "Hücre 1", "—", "Alıntı paragrafı"]);
    expect(pairs.map((p) => p.kind)).toEqual(["unit", "unit", "unit", "unit", "cell", "cell", "cell", "cell", "unit"]);
    expect(pairs[0].text).toBe("«Rusça» Başlık");
    expect(pairs[0].prefix).toBe("# ");
    expect(pairs[8].prefix).toBe("> ");
  });

  it("harita çiftlerden kurulur ve tekrar birleştirme çeviriyi aynen verir; yapı uyuşmazsa null", () => {
    const units = legalUnits(splitLegalMarkdown(SAMPLE));
    const translated = joinLegalMarkdown(splitLegalMarkdown(SAMPLE), dict("Rusça", units));
    const map = legalUnitMap(SAMPLE, translated)!;
    expect(joinLegalMarkdown(splitLegalMarkdown(SAMPLE), map)).toBe(translated);
    expect(legalUnitPairs(SAMPLE, translated + "\n\nFazladan paragraf")).toBeNull();
    expect(translated).toContain("| «Rusça» Hücre 1 | «Rusça» — |"); // "—" de bir hücre birimidir (boş olmayan her hücre)
    expect(legalUnitPairs(SAMPLE, translated.replace("| «Rusça» Hücre 1 | «Rusça» — |", "| «Rusça» Hücre 1 |"))).toBeNull();
  });

  it("değer kuralı: boş · satır sonu · sınır → Türkçe mesaj; geçerli → null (CRLF normalize)", () => {
    expect(legalEditError("   ")).toBe("Boş bırakılamaz.");
    expect(legalEditError("iki\nsatır")).toBe("Satır sonu kullanılamaz; paragraf tek satırdır.");
    expect(legalEditError("x".repeat(LEGAL_EDIT_MAX_CHARS + 1))).toBe(`En çok ${LEGAL_EDIT_MAX_CHARS} karakter.`);
    expect(legalEditError(" düzgün metin \r\n")).toBeNull();
  });
});

describe("normalizeLegalEdits — uç doğrulaması", () => {
  it("belgede olmayan anahtar · dizi · dize olmayan değer → hata; geçerli → kırpılmış harita", () => {
    expect(() => normalizeLegalEdits("aydinlatma", { "Olmayan birim": "x" })).toThrow(/belgede yok/);
    expect(() => normalizeLegalEdits("aydinlatma", ["x"])).toThrow(/biçimi geçersiz/);
    expect(() => normalizeLegalEdits("aydinlatma", { [U0]: 5 })).toThrow(/biçimi geçersiz/);
    expect(() => normalizeLegalEdits("aydinlatma", { [U0]: "a\nb" })).toThrow(/Satır sonu/);
    expect(normalizeLegalEdits("aydinlatma", { [U0]: "  Yeni çeviri  " })).toEqual({ [U0]: "Yeni çeviri" });
  });
});

describe("approveLegalTranslation + edits", () => {
  it("otomatik taban: düzenleme uygulanır, DÜZENLENMİŞ metin dondurulur, hash = yeni metnin sha256'sı, audit 'düzenlenen 1 birim'", async () => {
    const base = automatic();
    const row = await approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: sha256(base), edits: { [U0]: "Yeni çeviri" }, actor: ADMIN });
    const data = approvals.upsert.mock.calls[0][0].create as { markdown: string; textHash: string };
    expect(data.markdown).toContain("Yeni çeviri");
    expect(data.markdown).not.toContain(`«Rusça» ${U0}`);
    expect(data.markdown).toContain(`«Rusça» ${U1}`); // dokunulmayan birim otomatik kaldı
    expect(data.textHash).toBe(sha256(data.markdown));
    expect(data.textHash).not.toBe(sha256(base));
    expect(row.textHash).toBe(data.textHash);
    expect(lastDetail()).toMatch(/düzenlenen 1 birim$/);
    expect(get).not.toHaveBeenCalled(); // yalnız önbellek (generate:false)
  });

  it("taban hash uyuşmazsa 409 (LegalApprovalConflict) ve upsert YOK; biçimsiz hash de 409", async () => {
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: "0".repeat(64), edits: { [U0]: "x" }, actor: ADMIN })).rejects.toBeInstanceOf(LegalApprovalConflict);
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: "bozuk", edits: { [U0]: "x" }, actor: ADMIN })).rejects.toBeInstanceOf(LegalApprovalConflict);
    expect(approvals.upsert).not.toHaveBeenCalled();
  });

  it("değer kuralı ihlali 400 mesajıyla düşer (upsert YOK): boş · satır sonu · belgede olmayan birim", async () => {
    const base = automatic();
    const call = (edits: Record<string, string>) => approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: sha256(base), edits, actor: ADMIN });
    await expect(call({ [U0]: " " })).rejects.toThrow("Boş bırakılamaz.");
    await expect(call({ [U0]: "a\nb" })).rejects.toThrow(/Satır sonu/);
    await expect(call({ "Olmayan birim": "a" })).rejects.toThrow(/belgede yok/);
    expect(approvals.upsert).not.toHaveBeenCalled();
  });

  it("dondurulmuş taban: önceki düzeltme korunur, yeni düzeltme eklenir; taban hash = dondurulmuş metnin hash'i", async () => {
    const frozen = joinLegalMarkdown(splitLegalMarkdown(TR_DOC), { ...dict("Rusça", ALL_UNITS), [U0]: "Önceki düzeltme" });
    approvals.findUnique.mockResolvedValue(ROW({ markdown: frozen, textHash: sha256(frozen) }));
    await approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: sha256(frozen), edits: { [U1]: "İkinci düzeltme" }, actor: ADMIN });
    const data = approvals.upsert.mock.calls[0][0].update as { markdown: string };
    expect(data.markdown).toContain("Önceki düzeltme");
    expect(data.markdown).toContain("İkinci düzeltme");
    expect(lastDetail()).toMatch(/düzenlenen 1 birim$/);
    // otomatik metnin hash'iyle gelen onay (eski sayfa) → 409: dondurulmuş metin tabandır
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: sha256(automatic()), edits: { [U1]: "x" }, actor: ADMIN })).rejects.toBeInstanceOf(LegalApprovalConflict);
  });

  it("düzenlemesi tabanla özdeş olan birim sayılmaz; boş edits = düzenlemesiz onay (eski yol)", async () => {
    const base = automatic();
    await approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: sha256(base), edits: { [U0]: `«Rusça» ${U0}` }, actor: ADMIN });
    expect(lastDetail()).not.toMatch(/düzenlenen/);
    expect((approvals.upsert.mock.calls[0][0].create as { markdown: string }).markdown).toBe(base);
    approvals.upsert.mockClear();
    await approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: sha256(base), edits: {}, actor: ADMIN });
    expect((approvals.upsert.mock.calls[0][0].create as { markdown: string }).markdown).toBe(base);
  });
});

describe("'düzenlenmiş' bayrağı", () => {
  it("legalApprovalEdited: dondurulmuş hash ≠ otomatik → true; eşit → false", async () => {
    expect(await legalApprovalEdited({ textHash: sha256(automatic()) }, "aydinlatma", "Rusça")).toBe(false);
    expect(await legalApprovalEdited({ textHash: "a".repeat(64) }, "aydinlatma", "Rusça")).toBe(true);
  });

  it("kuyruk kalemi edited: reviewed + farklı hash → true, aynı hash → false, otomatik kalemde false", async () => {
    approvals.findMany.mockResolvedValue([
      ROW({ slug: "aydinlatma", lang: "Rusça", textHash: "a".repeat(64) }),
      ROW({ id: "r2", slug: "kosullar", lang: "Rusça", sourceHash: legalSourceHash("kosullar"), textHash: sha256(joinLegalMarkdown(splitLegalMarkdown(auraLegalDoc("kosullar")!.body.tr), dict("Rusça", legalMarkdownUnits(auraLegalDoc("kosullar")!.body.tr)))) }),
    ]);
    const items = await listLegalTranslationQueue();
    const find = (slug: string, lang: string) => items.find((i) => i.slug === slug && i.lang === lang)!;
    expect(find("aydinlatma", "Rusça")).toMatchObject({ state: "reviewed", edited: true });
    expect(find("kosullar", "Rusça")).toMatchObject({ state: "reviewed", edited: false });
    expect(find("cerez", "Rusça")).toMatchObject({ state: "automatic", edited: false });
  });
});

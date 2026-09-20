// Birim — 7-C (v6.286) hukuki çeviri onayı (lib/legal-approval): geçerli onay DONDURULMUŞ metni sunar (reviewed; çeviri motoru
// çağrılmaz), yoksa otomatik çeviri; kaynak hash/sürüm değişince ya da geri alınınca onay eskir; onay adminin gördüğü hash'le
// gider (uyuşmazlık → LegalApprovalConflict/409, upsert YOK), eksik/önbelleksiz çeviri onaylanamaz; kuyruk yayımlı belge × 9 dil
// kalemini ÖNBELLEKTEN kurar (dil başına tek sorgu, Claude'a istek yok); her eylem audit yazar.
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock fabrikaları dosya başına kaldırılır (hoist) → içlerinde kullanılan sabitler vi.hoisted ile tanımlanır.
// Çeviri önbelleği taklidi: birim → "«<dil>» <birim>". peek = yalnız önbellek, get = üretim yolu (ayrı sayaçlar).
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
  approveLegalTranslation,
  approvalIsCurrent,
  generateLegalTranslation,
  LEGAL_TRANSLATION_LANGS,
  LegalApprovalConflict,
  legalSourceHash,
  listLegalTranslationQueue,
  resolveLegalBody,
  revokeLegalTranslation,
} from "@/lib/legal-approval";
import { AURA_LEGAL_DOCS, AURA_LEGAL_VERSION } from "@/lib/aura-legal";
import { recordAccess } from "@/lib/audit";
import { sha256 } from "@/lib/timestamp";
import type { SessionUser } from "@/lib/session";

const ADMIN = { id: "a1", email: "admin@air.test", name: "Yönetici", role: "ADMIN" } as unknown as SessionUser;
const ROW = (o: Record<string, unknown> = {}) => ({
  id: "r1", slug: "aydinlatma", lang: "Rusça", version: AURA_LEGAL_VERSION, sourceHash: legalSourceHash("aydinlatma"),
  textHash: "f".repeat(64), markdown: "# Dondurulmuş metin", note: null, approvedAt: new Date("2026-09-20T10:00:00Z"),
  approvedById: "a1", approvedBy: "Yönetici", revokedAt: null, ...o,
});
const actions = () => vi.mocked(recordAccess).mock.calls.map((c) => c[0].action);

beforeEach(() => {
  approvals.findUnique.mockReset().mockResolvedValue(null);
  approvals.findMany.mockReset().mockResolvedValue([]);
  approvals.upsert.mockReset();
  approvals.update.mockReset().mockResolvedValue({});
  vi.mocked(recordAccess).mockClear();
  peek.mockClear().mockImplementation(async (lang, texts) => dict(lang, texts));
  get.mockClear().mockImplementation(async (lang, texts) => dict(lang, texts));
});

describe("resolveLegalBody — hasta yüzü gövdesi", () => {
  it("onay yokken otomatik çeviri: metin çevrilmiş, textHash = sunulan metnin sha256'sı, rozet automatic", async () => {
    const b = await resolveLegalBody("aydinlatma", "Rusça");
    expect(b?.status).toBe("automatic");
    expect(b?.reviewedAt).toBeNull();
    expect(b?.markdown).toContain("«Rusça»");
    expect(b?.textHash).toBe(sha256(b?.markdown ?? ""));
    expect(b?.partial).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("geçerli onay → DONDURULMUŞ metin aynen (reviewed + tarih + onay hash'i); çeviri motoru/önbellek HİÇ çağrılmaz", async () => {
    approvals.findUnique.mockResolvedValue(ROW());
    const b = await resolveLegalBody("aydinlatma", "Rusça");
    expect(b).toMatchObject({ status: "reviewed", markdown: "# Dondurulmuş metin", textHash: "f".repeat(64), partial: false });
    expect(b?.reviewedAt?.toISOString()).toBe("2026-09-20T10:00:00.000Z");
    expect(get).not.toHaveBeenCalled();
    expect(peek).not.toHaveBeenCalled();
    expect(approvals.findUnique.mock.calls[0][0].where.slug_lang_version).toEqual({ slug: "aydinlatma", lang: "Rusça", version: AURA_LEGAL_VERSION });
  });

  it("TR kaynak değişmiş (sourceHash farklı) onay ESKİR → otomatik çeviri", async () => {
    approvals.findUnique.mockResolvedValue(ROW({ sourceHash: "0".repeat(64) }));
    const b = await resolveLegalBody("aydinlatma", "Rusça");
    expect(b?.status).toBe("automatic");
    expect(b?.markdown).not.toContain("Dondurulmuş");
  });

  it("geri alınmış onay → otomatik çeviri", async () => {
    approvals.findUnique.mockResolvedValue(ROW({ revokedAt: new Date() }));
    expect((await resolveLegalBody("aydinlatma", "Rusça"))?.status).toBe("automatic");
  });

  it("generate:false yalnız önbelleğe bakar (peek), üretim yolu çağrılmaz; önbellek boşsa null (EN kanoniğe düşüş)", async () => {
    const b = await resolveLegalBody("kosullar", "Almanca", { generate: false });
    expect(b?.status).toBe("automatic");
    expect(peek).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    peek.mockImplementation(async () => ({}));
    expect(await resolveLegalBody("kosullar", "Almanca", { generate: false })).toBeNull();
  });

  it("Türkçe/İngilizce kanonik → null (çeviri yok)", async () => {
    expect(await resolveLegalBody("aydinlatma", "Türkçe")).toBeNull();
    expect(await resolveLegalBody("aydinlatma", "İngilizce")).toBeNull();
    expect(approvals.findUnique).not.toHaveBeenCalled();
  });
});

describe("approvalIsCurrent", () => {
  it("sürüm, kaynak hash ve geri alma üçü birden", () => {
    expect(approvalIsCurrent(ROW(), "aydinlatma")).toBe(true);
    expect(approvalIsCurrent(ROW({ version: "0.9" }), "aydinlatma")).toBe(false);
    expect(approvalIsCurrent(ROW({ sourceHash: "x" }), "aydinlatma")).toBe(false);
    expect(approvalIsCurrent(ROW({ revokedAt: new Date() }), "aydinlatma")).toBe(false);
    expect(approvalIsCurrent(ROW(), "kosullar")).toBe(false); // başka belgenin kaynağı
  });
});

describe("approveLegalTranslation", () => {
  it("adminin gördüğü hash sunucu hesabıyla uyuşmazsa LegalApprovalConflict — upsert YOK, audit YOK", async () => {
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: "a".repeat(64), actor: ADMIN })).rejects.toBeInstanceOf(LegalApprovalConflict);
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: "bozuk", actor: ADMIN })).rejects.toBeInstanceOf(LegalApprovalConflict);
    expect(approvals.upsert).not.toHaveBeenCalled();
    expect(recordAccess).not.toHaveBeenCalled();
  });

  it("doğru hash → satır DONDURULMUŞ metinle upsert (create + update aynı içerik, revokedAt temizlenir) + LEGAL_TRANSLATION_APPROVE", async () => {
    const seen = await resolveLegalBody("aydinlatma", "Rusça", { generate: false });
    approvals.upsert.mockImplementation(async (args: { create: Record<string, unknown> }) => ({ id: "r-new", ...args.create, approvedAt: new Date(), revokedAt: null }));
    const row = await approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: seen?.textHash ?? "", note: "  terimler kontrol edildi ", actor: ADMIN, ip: "1.2.3.4" });
    const args = approvals.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ slug_lang_version: { slug: "aydinlatma", lang: "Rusça", version: AURA_LEGAL_VERSION } });
    expect(args.create).toMatchObject({
      slug: "aydinlatma", lang: "Rusça", version: AURA_LEGAL_VERSION, sourceHash: legalSourceHash("aydinlatma"),
      textHash: seen?.textHash, markdown: seen?.markdown, note: "terimler kontrol edildi", approvedById: "a1", approvedBy: "Yönetici",
    });
    expect(args.update).toMatchObject({ textHash: seen?.textHash, markdown: seen?.markdown, revokedAt: null, approvedById: "a1" });
    expect(row.id).toBe("r-new");
    expect(recordAccess).toHaveBeenCalledWith(expect.objectContaining({
      action: "LEGAL_TRANSLATION_APPROVE", resourceType: "LegalTranslationApproval", resourceId: "r-new", subjectUserId: null, ip: "1.2.3.4",
      detail: `aydinlatma·Rusça·v${AURA_LEGAL_VERSION}·${seen?.textHash.slice(0, 12)}`,
    }));
    // Onay yalnız ÖNBELLEĞE bakar (peek) — onay sırasında üretim tetiklenmez.
    expect(get).not.toHaveBeenCalled();
  });

  it("eksik çeviri (bazı birimler TR) onaylanamaz", async () => {
    peek.mockImplementation(async (lang, texts) => dict(lang, texts.slice(0, 3)));
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: "b".repeat(64), actor: ADMIN })).rejects.toThrow(/eksik/i);
    expect(approvals.upsert).not.toHaveBeenCalled();
  });

  it("önbellekte hiç çeviri yokken → 'önce üretin'; TR/EN ve yayımsız belge → hata", async () => {
    peek.mockImplementation(async () => ({}));
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Rusça", textHash: "b".repeat(64), actor: ADMIN })).rejects.toThrow(/önce üretin/);
    await expect(approveLegalTranslation({ slug: "aydinlatma", lang: "Türkçe", textHash: "b".repeat(64), actor: ADMIN })).rejects.toThrow(/kanonik/);
    await expect(approveLegalTranslation({ slug: "tele-saglik", lang: "Rusça", textHash: "b".repeat(64), actor: ADMIN })).rejects.toThrow(/yayımda değil/);
  });
});

describe("revokeLegalTranslation", () => {
  it("geçerli onay → revokedAt damgalanır + LEGAL_TRANSLATION_REVOKE", async () => {
    approvals.findUnique.mockResolvedValue(ROW());
    await revokeLegalTranslation({ slug: "aydinlatma", lang: "Rusça", actor: ADMIN });
    expect(approvals.update.mock.calls[0][0]).toMatchObject({ where: { id: "r1" } });
    expect(approvals.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
    expect(actions()).toEqual(["LEGAL_TRANSLATION_REVOKE"]);
  });

  it("onay yok ya da zaten geri alınmış → hata, yazma yok", async () => {
    await expect(revokeLegalTranslation({ slug: "aydinlatma", lang: "Rusça", actor: ADMIN })).rejects.toThrow(/geçerli bir onay yok/);
    approvals.findUnique.mockResolvedValue(ROW({ revokedAt: new Date() }));
    await expect(revokeLegalTranslation({ slug: "aydinlatma", lang: "Rusça", actor: ADMIN })).rejects.toThrow(/geçerli bir onay yok/);
    expect(approvals.update).not.toHaveBeenCalled();
  });
});

describe("generateLegalTranslation", () => {
  it("üretim yolunu (getLegalTranslations) çağırır, sayaçları döner, LEGAL_TRANSLATION_GENERATE yazar", async () => {
    const r = await generateLegalTranslation({ slug: "cerez", lang: "Arapça", actor: ADMIN });
    expect(get).toHaveBeenCalledTimes(1);
    expect(r?.complete).toBe(true);
    expect(r?.translated).toBe(r?.units);
    expect(recordAccess).toHaveBeenCalledWith(expect.objectContaining({
      action: "LEGAL_TRANSLATION_GENERATE", resourceId: "cerez:Arapça", detail: `${r?.translated}/${r?.units} birim`,
    }));
  });
});

describe("listLegalTranslationQueue", () => {
  it("yayımlı belge × TR/EN dışı dil kalemleri; dil başına TEK önbellek sorgusu; üretim yok; durum matrisi", async () => {
    approvals.findMany.mockResolvedValue([
      ROW(),
      ROW({ id: "r2", slug: "kosullar", sourceHash: "0".repeat(64) }),
      ROW({ id: "r3", slug: "cerez", revokedAt: new Date(), note: "eski onay" }),
    ]);
    peek.mockImplementation(async (lang, texts) => (lang === "Almanca" ? {} : lang === "Arapça" ? dict(lang, texts.slice(0, 5)) : dict(lang, texts)));
    const items = await listLegalTranslationQueue();
    const published = AURA_LEGAL_DOCS.filter((d) => d.published).length;
    expect(LEGAL_TRANSLATION_LANGS).toHaveLength(9);
    expect(items).toHaveLength(published * 9);
    expect(peek).toHaveBeenCalledTimes(9);
    expect(get).not.toHaveBeenCalled();
    expect(approvals.findMany.mock.calls[0][0]).toEqual({ where: { version: AURA_LEGAL_VERSION } });

    const at = (slug: string, lang: string) => items.find((i) => i.slug === slug && i.lang === lang);
    expect(at("aydinlatma", "Rusça")).toMatchObject({ state: "reviewed", textHash: "f".repeat(64), approvedBy: "Yönetici", code: "ru" });
    expect(at("kosullar", "Rusça")?.state).toBe("stale");
    expect(at("cerez", "Rusça")).toMatchObject({ state: "revoked", approvedAt: null, approvedBy: null, note: "eski onay" });
    expect(at("kvkk-basvuru", "Rusça")?.state).toBe("automatic");
    expect(at("aydinlatma", "Almanca")).toMatchObject({ state: "missing", units: 0, textHash: null });
    expect(at("aydinlatma", "Arapça")?.state).toBe("incomplete");
    // otomatik kalemin hash'i sunulan metnin sha256'sı (onayda aynı hash gönderilir)
    const auto = at("kvkk-basvuru", "Rusça");
    const served = await resolveLegalBody("kvkk-basvuru", "Rusça", { generate: false });
    expect(auto?.textHash).toBe(served?.textHash);
  });
});

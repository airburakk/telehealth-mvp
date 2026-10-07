// İçerik takvimi — rubrik kayıt defteri · durum makinesi · yük (payload) · onay kapıları sözleşmeleri (v6.328, 2026-10-06).
import { describe, expect, it } from "vitest";
import { evaluateGates, failedGates, MIN_NOTE_BULLETS, type GateId, type GateInput } from "@/lib/social-calendar/gates";
import { buildKararDraft } from "@/lib/social-calendar/karar";
import {
  LIMITS,
  applyEditorNote,
  canonicalJson,
  noteFromPayload,
  noteLines,
  normalizePayload,
  parsePayload,
  payloadHash,
  type PlanPayload,
} from "@/lib/social-calendar/payload";
import {
  SERIES,
  addDays,
  isDayString,
  isoWeekday,
  seriesByKey,
  slotMatchesSeries,
  slotsOfWeek,
  weekDays,
  weekStart,
} from "@/lib/social-calendar/series";
import { PLAN_STATUSES, isEditable, isPlanStatus, nextStatus, type PlanEvent, type PlanStatus } from "@/lib/social-calendar/status";
import { ELLIPSIS } from "@/lib/social-calendar/text";

// ── Rubrik kayıt defteri + takvim aritmetiği ─────────────────────────────────────────────────────────

describe("series — kayıt defteri", () => {
  it("üç rubrik; hafta günleri 👤 kararı: Pzt etkinlik · Çar karar masası · Cum öğrenci", () => {
    expect(SERIES.map((s) => [s.key, s.weekday])).toEqual([
      ["etkinlik-radari", 1],
      ["karar-masasi", 3],
      ["ogrenci-kosesi", 5],
    ]);
  });
  it("yalnız hukuk günü legal + kimlik onayı + çıkarım etiketi + alıntı rolleri taşır", () => {
    const k = seriesByKey("karar-masasi");
    expect(k?.approval).toBe("legal");
    expect(k?.attestIdentity).toBe(true);
    expect(k?.noteLabel).toBe("Doktor için çıkarım");
    expect(k?.quoteRoles).toEqual(["uyusmazlik", "gerekce"]);
    for (const s of SERIES.filter((x) => x.key !== "karar-masasi")) {
      expect(s.approval).toBe("light");
      expect(s.attestIdentity).toBe(false);
      expect(s.noteLabel).toBeNull();
      expect(s.quoteRoles).toEqual([]);
    }
  });
  it("zorunlu roller iskelette bulunur; bilinmeyen anahtar null", () => {
    for (const s of SERIES) for (const r of s.requiredRoles) expect(s.slideRoles).toContain(r);
    expect(seriesByKey("yok")).toBeNull();
  });
});

describe("series — gün aritmetiği (UTC takvim günü)", () => {
  it("isDayString taşan günleri reddeder", () => {
    expect(isDayString("2026-10-07")).toBe(true);
    expect(isDayString("2026-02-30")).toBe(false);
    expect(isDayString("2026-13-01")).toBe(false);
    expect(isDayString("07.10.2026")).toBe(false);
    expect(isDayString(20261007)).toBe(false);
  });
  it("hafta günü, hafta başı ve yedi gün", () => {
    expect(isoWeekday("2026-10-05")).toBe(1); // Pazartesi
    expect(isoWeekday("2026-10-07")).toBe(3); // Çarşamba
    expect(isoWeekday("2026-10-11")).toBe(7); // Pazar
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekDays("2026-10-05")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });
  it("ay/yıl taşması", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("haftanın yuvaları gün sırasında; (rubrik, gün) uyumu doğrulanır", () => {
    const slots = slotsOfWeek("2026-10-05");
    expect(slots.map((s) => [s.series.key, s.slotDay])).toEqual([
      ["etkinlik-radari", "2026-10-05"],
      ["karar-masasi", "2026-10-07"],
      ["ogrenci-kosesi", "2026-10-09"],
    ]);
    const karar = seriesByKey("karar-masasi");
    expect(karar && slotMatchesSeries(karar, "2026-10-07")).toBe(true);
    expect(karar && slotMatchesSeries(karar, "2026-10-08")).toBe(false);
    expect(karar && slotMatchesSeries(karar, "2026-02-30")).toBe(false);
  });
});

// ── Durum makinesi ───────────────────────────────────────────────────────────────────────────────────

describe("status — geçiş tablosu", () => {
  const ALL_EVENTS: PlanEvent[] = ["pick", "save", "approve", "unapprove", "skip", "restore", "claim", "publish-ok", "publish-fail", "retry"];
  const TABLE: Record<PlanStatus, Partial<Record<PlanEvent, PlanStatus>>> = {
    PLANNED: { pick: "DRAFT", save: "DRAFT", skip: "SKIPPED" },
    DRAFT: { pick: "DRAFT", save: "DRAFT", approve: "APPROVED", skip: "SKIPPED" },
    APPROVED: { pick: "DRAFT", save: "DRAFT", unapprove: "DRAFT", skip: "SKIPPED", claim: "PUBLISHING", "publish-ok": "PUBLISHED" },
    // YAYINLANIYOR: otomasyon aldı. Yalnız sonuç (ok/hata) ya da İNSAN çözümü (retry) çıkar; düzenleme/atlama/onay-kaldırma YOK.
    PUBLISHING: { "publish-ok": "PUBLISHED", "publish-fail": "FAILED", retry: "APPROVED" },
    PUBLISHED: {},
    SKIPPED: { restore: "PLANNED" }, // taslak yoksa; taslak varsa DRAFT (aşağıda ayrıca)
    FAILED: { skip: "SKIPPED", retry: "APPROVED" },
  };
  it("tablodaki her (durum, olay) çifti beklenen sonucu verir; tabloda olmayan HER çift null", () => {
    for (const st of PLAN_STATUSES) {
      for (const ev of ALL_EVENTS) {
        expect(nextStatus(st, ev), `${st} + ${ev}`).toBe(TABLE[st][ev] ?? null);
      }
    }
  });
  it("atlanan yuvayı geri alma: taslak varsa DRAFT, yoksa PLANNED (veri atlama sırasında kalır)", () => {
    expect(nextStatus("SKIPPED", "restore", { hasPayload: true })).toBe("DRAFT");
    expect(nextStatus("SKIPPED", "restore", { hasPayload: false })).toBe("PLANNED");
  });
  it("onaylı içerik DÜZENLENİNCE onay düşer (save/pick → DRAFT); yayınlanmış içerik değişmez", () => {
    expect(nextStatus("APPROVED", "save")).toBe("DRAFT");
    expect(nextStatus("PUBLISHED", "save")).toBeNull();
    expect(isEditable("APPROVED")).toBe(true);
    expect(isEditable("PUBLISHED")).toBe(false);
    expect(isEditable("SKIPPED")).toBe(false);
  });
  it("YAYINLANIYOR kilidi: yalnız ONAYLI alınır (ikinci koşu alamaz); hata YALNIZ alınmış içerik için gelir; takılı kilidi insan açar", () => {
    expect(nextStatus("APPROVED", "claim")).toBe("PUBLISHING");
    expect(nextStatus("PUBLISHING", "claim")).toBeNull(); // çift alma YOK → en fazla bir kez yayın
    for (const st of ["PLANNED", "DRAFT", "PUBLISHED", "SKIPPED", "FAILED"] as const) expect(nextStatus(st, "claim"), st).toBeNull();
    expect(nextStatus("APPROVED", "publish-fail")).toBeNull(); // alınmadan hata bildirilemez
    expect(nextStatus("PUBLISHING", "retry")).toBe("APPROVED"); // "yayınlanmadı" → yeniden denenebilir
    expect(nextStatus("PUBLISHING", "skip")).toBeNull(); // önce çözülmeli
    expect(isEditable("PUBLISHING")).toBe(false);
  });
  it("isPlanStatus bilinmeyen değeri reddeder", () => {
    expect(isPlanStatus("DRAFT")).toBe(true);
    expect(isPlanStatus("IN_REVIEW")).toBe(false);
    expect(isPlanStatus(null)).toBe(false);
  });
});

// ── Yük (payload) ────────────────────────────────────────────────────────────────────────────────────

const okPayload = (): PlanPayload => ({
  v: 1,
  slides: [
    { role: "kapak", title: "Başlık", body: "Gövde" },
    { role: "uyusmazlik", title: "Uyuşmazlık", body: "Uyuşmazlık, … ilişkindir.", quote: true },
    { role: "cikarim", title: "Doktor için çıkarım", body: "", bullets: ["bir", "iki"] },
  ],
  caption: "Altyazı metni burada.",
  hashtags: ["#Bir"],
  sources: [{ label: "Yargıtay", ref: "E. 1, K. 2" }],
});

describe("payload — normalizePayload", () => {
  it("geçerli girdiyi temizleyip kabul eder; bilinmeyen alanlar atılır", () => {
    const r = normalizePayload({ ...okPayload(), evil: "x", slides: [{ role: "kapak", title: "  A  ", body: "B", extra: 1 }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.slides[0]).toEqual({ role: "kapak", title: "A", body: "B" });
      expect("evil" in r.payload).toBe(false);
    }
  });
  it("etiketleri '#' ile normalize eder, boşlukları atar", () => {
    const r = normalizePayload({ slides: [], caption: "", hashtags: ["Karar Masası", "#Yargıtay", "  "], sources: [] });
    expect(r.ok && r.payload.hashtags).toEqual(["#KararMasası", "#Yargıtay"]);
  });
  it("sınır ihlalleri açık hata mesajıyla reddedilir", () => {
    const bad = (p: unknown) => {
      const r = normalizePayload(p);
      return r.ok ? null : r.error;
    };
    expect(bad(null)).toMatch(/geçersiz/);
    expect(bad({})).toMatch(/Slayt listesi/);
    expect(bad({ slides: [{ role: "yok", title: "", body: "" }] })).toMatch(/geçersiz rol/);
    expect(bad({ slides: [{ role: "kapak", title: "x".repeat(LIMITS.title + 1), body: "" }] })).toMatch(/başlık/);
    expect(bad({ slides: [{ role: "kapak", title: "", body: "x".repeat(LIMITS.body + 1) }] })).toMatch(/gövde/);
    expect(bad({ slides: Array.from({ length: LIMITS.maxSlides + 1 }, () => ({ role: "genel", title: "a", body: "b" })) })).toMatch(/slayt olabilir/);
    expect(bad({ slides: [], caption: "x".repeat(LIMITS.caption + 1) })).toMatch(/Altyazı/);
    expect(bad({ slides: [], hashtags: Array.from({ length: LIMITS.hashtags + 1 }, (_, i) => `#t${i}`) })).toMatch(/etiket/);
    expect(bad({ slides: [{ role: "kapak", title: "", body: "", bullets: ["a", 5] }] })).toMatch(/maddeler/);
  });
  it("parsePayload bozuk JSON'da null döner (sayfa çökmez)", () => {
    expect(parsePayload("{bozuk")).toBeNull();
    expect(parsePayload(null)).toBeNull();
    expect(parsePayload(JSON.stringify(okPayload()))).not.toBeNull();
  });
});

describe("payload — mühür (canonicalJson / payloadHash)", () => {
  it("içerik değişince hash değişir", () => {
    const a = okPayload();
    const b = okPayload();
    b.slides[0] = { role: "kapak", title: "Başlık", body: "Gövde!" };
    expect(payloadHash(a)).not.toBe(payloadHash(b));
  });
  it("`auto` ve `meta` hash'e GİRMEZ (onayı düşürmemeli); `quote` bayrağı girer", () => {
    const a = okPayload();
    const b = okPayload();
    b.slides[0] = { ...b.slides[0]!, auto: true };
    b.meta = { theme: "komplikasyon", daire: "3. Hukuk Dairesi" };
    expect(payloadHash(a)).toBe(payloadHash(b));
    const c = okPayload();
    c.slides[1] = { ...c.slides[1]!, quote: false };
    expect(payloadHash(a)).not.toBe(payloadHash(c));
  });
  it("kanonik biçim anahtar sırasından bağımsızdır", () => {
    const a = JSON.parse(JSON.stringify(okPayload())) as PlanPayload;
    const reordered = { sources: a.sources, hashtags: a.hashtags, caption: a.caption, slides: a.slides.map((s) => ({ body: s.body, title: s.title, role: s.role, ...(s.bullets ? { bullets: s.bullets } : {}), ...(s.quote ? { quote: true } : {}) })), v: 1 };
    const n = normalizePayload(reordered);
    expect(n.ok && canonicalJson(n.payload)).toBe(canonicalJson(a));
    expect(payloadHash(okPayload())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("payload — 'Doktor için çıkarım' editör metni", () => {
  it("satır başı numara/madde işaretlerini atar, boş satırları eler", () => {
    expect(noteLines("1) Birinci madde\n2. İkinci madde\n- Üçüncü\n• Dördüncü\n\n  \n* Beşinci")).toEqual(["Birinci madde", "İkinci madde", "Üçüncü", "Dördüncü", "Beşinci"]);
    expect(noteLines(null)).toEqual([]);
  });
  it("metni cikarim slaytının maddelerine yansıtır, `auto` bayrağı düşer, girdiyi DEĞİŞTİRMEZ", () => {
    const p = okPayload();
    p.slides[2] = { ...p.slides[2]!, auto: true };
    const q = applyEditorNote(p, "1) Aydınlatma belgesi dosyada olmalı\n2) Komplikasyon kaydı tutulmalı\n3) Bilgilendirme zamanında yapılmalı");
    expect(q.slides[2]?.bullets).toHaveLength(3);
    expect(q.slides[2]?.auto).toBeUndefined();
    expect(p.slides[2]?.bullets).toEqual(["bir", "iki"]);
    expect(p.slides[2]?.auto).toBe(true);
  });
  it("en çok LIMITS.bullets madde; cikarim slaytı yoksa payload aynen kalır; gidiş-dönüş", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Madde numarası ${i}`).join("\n");
    expect(applyEditorNote(okPayload(), many).slides[2]?.bullets).toHaveLength(LIMITS.bullets);
    const noCikarim: PlanPayload = { ...okPayload(), slides: okPayload().slides.slice(0, 2) };
    expect(applyEditorNote(noCikarim, "x yazı").slides).toEqual(noCikarim.slides);
    const p = applyEditorNote(okPayload(), "Birinci madde metni\nİkinci madde metni");
    expect(noteFromPayload(p)).toBe("1) Birinci madde metni\n2) İkinci madde metni");
    expect(noteFromPayload(null)).toBe("");
  });
});

// ── Onay kapıları ────────────────────────────────────────────────────────────────────────────────────

const KARAR = seriesByKey("karar-masasi")!;
const ETKINLIK = seriesByKey("etkinlik-radari")!;

const SOURCE_TEXT = `Davacı vekili; ... Uyuşmazlık, davalı özel sağlık kuruluşu ile doktorun vekalet sözleşmesinden kaynaklanan özen borcuna aykırı davranıldığı iddiasına dayalı maddi ve manevi tazminat istemine ilişkindir.
Temyiz edilen kararda belirtilen gerekçeye, hükme esas alınan raporların denetime elverişli olduğunun anlaşılmasına göre, davacı vekilinin temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.`;

const NOTE = "1) Aydınlatma belgesi her işlemde dosyada bulunmalı\n2) Komplikasyon kaydı hasta dosyasına işlenmeli\n3) Bilgilendirme işlemden önce ve anlaşılır yapılmalı";

function legalInput(over: Partial<GateInput> = {}, mutate?: (p: PlanPayload) => void): GateInput {
  const payload: PlanPayload = {
    v: 1,
    slides: [
      { role: "kapak", title: "Karar masası", body: "Yargıtay 3. Hukuk Dairesi" },
      { role: "uyusmazlik", title: "Uyuşmazlık", body: "Uyuşmazlık, davalı özel sağlık kuruluşu ile doktorun vekalet sözleşmesinden kaynaklanan özen borcuna aykırı davranıldığı iddiasına dayalı maddi ve manevi tazminat istemine ilişkindir.", quote: true },
      { role: "gerekce", title: "Yargıtay gerekçesi", body: `Temyiz edilen kararda belirtilen gerekçeye, ${ELLIPSIS} davacı vekilinin temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.`, quote: true },
      { role: "sonuc", title: "Karar onandı", body: "Onama: Yargıtay, temyiz edilen kararı yerinde bulmuştur." },
      { role: "cikarim", title: "Doktor için çıkarım", body: "", bullets: NOTE.split("\n").map((l) => l.replace(/^\d\)\s*/, "")) },
      { role: "kaynak", title: "Kaynak ve uyarı", body: "Kaynak: Yargıtay 3. HD.\n\nBu içerik bilgilendirme amaçlıdır; hukuki görüş değildir." },
    ],
    caption: "⚖️ Karar masası · Yargıtay kararı. Bu içerik bilgilendirme amaçlıdır; hukuki görüş değildir.",
    hashtags: ["#KararMasası"],
    sources: [{ label: "Yargıtay 3. Hukuk Dairesi", ref: "E. 1, K. 2" }],
  };
  mutate?.(payload);
  return { series: KARAR, payload, attestIdentity: true, sourceIds: ["a1"], sourceTexts: [SOURCE_TEXT], now: new Date("2026-10-06T10:00:00Z"), ...over };
}

const gate = (r: ReturnType<typeof evaluateGates>, id: GateId) => r.gates.find((g) => g.id === id);

describe("gates — hukuk günü (temiz taslak)", () => {
  it("tüm kapılar geçer; dokuz kapı raporlanır", () => {
    const r = evaluateGates(legalInput());
    expect(failedGates(r)).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.gates.map((g) => g.id)).toEqual(["kaynak", "slayt", "uzunluk", "cikarim", "uyari", "alinti", "ifade", "kimlik-tarama", "kimlik-onay"]);
    expect(r.checkedAt).toBe("2026-10-06T10:00:00.000Z");
  });
  it("gerçek üretici çıktısı (buildKararDraft) + 3 madde çıkarım kapılardan geçer — üretici ile kapı UYUMLU", () => {
    const text = `3. Hukuk Dairesi  2025/4384 E. , 2026/1817 K.\n\nI. DAVA\n${"Davacı vekili; tedavi sonucu zarar gördüğünü ileri sürerek tazminat talep etmiştir. ".repeat(40)}\nV. TEMYİZ\nA. Temyiz Sebepleri\n${"Davacı vekili; kararın bozulmasını talep etmiştir. ".repeat(10)}\nB. Değerlendirme ve Gerekçe\nUyuşmazlık, davalı doktorun vekalet sözleşmesinden kaynaklanan özen borcuna aykırı davranıldığı iddiasına dayalı maddi ve manevi tazminat istemine ilişkindir.\nHükme esas alınan raporların birbiriyle uyumlu ve denetime elverişli olduğu, komplikasyonun her türlü özene rağmen gelişebildiği anlaşıldığından davacı vekilinin temyiz itirazlarının reddi ile usul ve kanuna uygun olan kararın onanmasına karar verilmiştir.\nVI. KARAR\nAçıklanan sebeplerle;\nTemyiz olunan kararın ONANMASINA,\n13.05.2026 tarihinde oy birliğiyle karar verildi.`;
    const draft = buildKararDraft({ id: "x", title: "Yargıtay 3. Hukuk Dairesi · E. 2025/4384, K. 2026/1817", summary: text, publishedAt: "2026-05-13T00:00:00Z" });
    expect(draft).not.toBeNull();
    const withNote = applyEditorNote(draft!, NOTE);
    const r = evaluateGates({ series: KARAR, payload: withNote, attestIdentity: true, sourceIds: ["x"], sourceTexts: [text] });
    expect(failedGates(r).map((g) => `${g.id}: ${g.detail}`)).toEqual([]);
  });
  it("taslak yoksa tek başarısız kapı: slayt", () => {
    const r = evaluateGates(legalInput({ payload: null }));
    expect(r.ok).toBe(false);
    expect(r.gates).toHaveLength(1);
    expect(r.gates[0]?.id).toBe("slayt");
  });
});

describe("gates — her kapı kendi ihlalinde engeller", () => {
  it("kaynak: karar seçilmemiş / künye boş", () => {
    expect(gate(evaluateGates(legalInput({ sourceIds: [] })), "kaynak")?.ok).toBe(false);
    expect(gate(evaluateGates(legalInput({}, (p) => { p.sources = []; })), "kaynak")?.ok).toBe(false);
  });
  it("slayt: zorunlu rol eksik / boş slayt / az slayt", () => {
    const eksik = evaluateGates(legalInput({}, (p) => { p.slides = p.slides.filter((s) => s.role !== "gerekce"); }));
    expect(gate(eksik, "slayt")?.ok).toBe(false);
    expect(gate(eksik, "slayt")?.detail).toContain("Yargıtay gerekçesi");
    const az = evaluateGates(legalInput({}, (p) => { p.slides = p.slides.slice(0, 2); }));
    expect(gate(az, "slayt")?.detail).toMatch(/en az 3 slayt/);
  });
  it("uzunluk: altyazı çok kısa", () => {
    const r = evaluateGates(legalInput({}, (p) => { p.caption = "kısa"; }));
    expect(gate(r, "uzunluk")?.ok).toBe(false);
  });
  it("çıkarım: boş · az madde · kısa madde engeller; yeterli geçer", () => {
    const cik = (bullets: string[]) => evaluateGates(legalInput({}, (p) => { const s = p.slides.find((x) => x.role === "cikarim"); if (s) s.bullets = bullets; }));
    expect(gate(cik([]), "cikarim")?.ok).toBe(false);
    expect(gate(cik(["Yeterince uzun bir madde var", "Bir tane daha uzun madde yazıldı"]), "cikarim")?.ok).toBe(false);
    expect(gate(cik(["Yeterince uzun bir madde var", "Bir tane daha uzun madde yazıldı", "kısa"]), "cikarim")?.ok).toBe(false);
    expect(gate(cik(["Yeterince uzun bir madde var", "Bir tane daha uzun madde yazıldı", "Üçüncü uzun madde de burada"]), "cikarim")?.ok).toBe(true);
    expect(MIN_NOTE_BULLETS).toBe(3);
  });
  it("uyarı: kaynak slaytında iki ifade de zorunlu", () => {
    const r = evaluateGates(legalInput({}, (p) => { const k = p.slides.find((s) => s.role === "kaynak"); if (k) k.body = "Kaynak: Yargıtay. Bu içerik bilgilendirme amaçlıdır."; }));
    expect(gate(r, "uyari")?.ok).toBe(false);
    expect(gate(r, "uyari")?.detail).toContain("hukuki görüş değildir");
  });
  it("alıntı: kaynakta olmayan metin · alıntı bayrağı sökülmüş · kaynak metni yok", () => {
    const degisik = evaluateGates(legalInput({}, (p) => { const g = p.slides.find((s) => s.role === "gerekce"); if (g) g.body = "Kararın BOZULMASINA karar verilmiştir."; }));
    expect(gate(degisik, "alinti")?.ok).toBe(false);
    expect(gate(degisik, "alinti")?.detail).toContain("aynen yok");
    const bayraksiz = evaluateGates(legalInput({}, (p) => { const u = p.slides.find((s) => s.role === "uyusmazlik"); if (u) u.quote = false; }));
    expect(gate(bayraksiz, "alinti")?.detail).toContain("alıntı olarak işaretli değil");
    expect(gate(evaluateGates(legalInput({ sourceTexts: [] })), "alinti")?.detail).toContain("okunamadı");
  });
  it("yasak ifade: kendi metnimizde 'hekim' / 'uçtan uca' / garanti engeller; ALINTI slaytında 'hekim' serbest", () => {
    const kendi = evaluateGates(legalInput({}, (p) => { const c = p.slides.find((s) => s.role === "cikarim"); if (c) c.bullets = ["Hekim aydınlatmayı yazılı yapmalı", "Kayıt uçtan uca tutulmalı", "Sonuç garantisi verilmemeli"]; }));
    expect(gate(kendi, "ifade")?.ok).toBe(false);
    expect(gate(kendi, "ifade")?.detail).toMatch(/hekim/);
    expect(gate(kendi, "ifade")?.detail).toMatch(/uçtan uca/);
    expect(gate(kendi, "ifade")?.detail).toMatch(/garanti/);
    const alinti = evaluateGates(legalInput({ sourceTexts: [`${SOURCE_TEXT}\nHekim ve hasta arasındaki ilişki vekalet sözleşmesidir.`] }, (p) => { const g = p.slides.find((s) => s.role === "gerekce"); if (g) g.body = "Hekim ve hasta arasındaki ilişki vekalet sözleşmesidir."; }));
    expect(gate(alinti, "ifade")?.ok).toBe(true);
  });
  it("kimlik taraması: alıntı DAHİL tüm metinde sızıntı engeller", () => {
    const sizinti = "Temyiz edilen kararda davacının Mina'nın erken taburcu edildiği belirtilmiştir.";
    const r = evaluateGates(legalInput({ sourceTexts: [`${SOURCE_TEXT}\n${sizinti}`] }, (p) => { const g = p.slides.find((s) => s.role === "gerekce"); if (g) g.body = sizinti; }));
    expect(gate(r, "kimlik-tarama")?.ok).toBe(false);
    expect(gate(r, "kimlik-tarama")?.detail).toContain("taraf adı");
    const telefon = evaluateGates(legalInput({}, (p) => { p.caption += " Bilgi: 0532 123 45 67"; }));
    expect(gate(telefon, "kimlik-tarama")?.ok).toBe(false);
  });
  it("kimlik onayı: kutu işaretlenmeden onay YOK (tarama temiz olsa bile)", () => {
    const r = evaluateGates(legalInput({ attestIdentity: false }));
    expect(gate(r, "kimlik-tarama")?.ok).toBe(true);
    expect(gate(r, "kimlik-onay")?.ok).toBe(false);
    expect(r.ok).toBe(false);
  });
});

describe("gates — hafif rubrik (etkinlik radarı)", () => {
  const light = (mutate?: (p: PlanPayload) => void): GateInput => ({
    series: ETKINLIK,
    payload: (() => {
      const p: PlanPayload = {
        v: 1,
        slides: [
          { role: "kapak", title: "Bu haftanın etkinlikleri", body: "Kongre ve STE takvimi" },
          { role: "genel", title: "Prof. Dr. Ali Veli konuşması", body: "Konuşmacı unvanlı adla anılabilir; kimlik taraması bu rubrikte çalışmaz." },
          { role: "kaynak", title: "Kaynak", body: "Kongre takvimi (doctorium.tr)" },
        ],
        caption: "Haftanın kongre ve eğitim etkinlikleri burada.",
        hashtags: [],
        sources: [{ label: "Doctorium kongre takvimi", ref: "doctorium.tr/akademik" }],
      };
      mutate?.(p);
      return p;
    })(),
    attestIdentity: false,
    sourceIds: [],
    sourceTexts: [],
  });
  it("yalnız kaynak · slayt · uzunluk · ifade kapıları koşar; kimlik/uyarı/alıntı/çıkarım yok", () => {
    const r = evaluateGates(light());
    expect(r.gates.map((g) => g.id)).toEqual(["kaynak", "slayt", "uzunluk", "ifade"]);
    expect(r.ok).toBe(true);
  });
  it("yasak ifade burada da engeller", () => {
    expect(evaluateGates(light((p) => { p.caption = "Hekimler için etkinlik takvimi bu hafta burada."; })).ok).toBe(false);
  });
  it("kaynak künyesi boşsa engeller", () => {
    expect(gate(evaluateGates(light((p) => { p.sources = []; })), "kaynak")?.ok).toBe(false);
  });
});

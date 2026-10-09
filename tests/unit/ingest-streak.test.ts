// İçerik hattı sessiz kuruma nöbeti — saf mantık sözleşmeleri (v6.337, 2026-10-07).
//
// Kilitlenenler:
//   1) İlk hata metni audit detail'ine tek satır, kısa ve segment ayracını (" · ") bozmadan girer.
//   2) "Kuru" = iş çöktü (`hata:`) YA DA hiçbir şey bulamayıp hata verdi (`yeni=0/0 sorun=N`).
//      Hatasız 0/0 ve kısmi bulgu (0/60 sorun=4) kuru DEĞİLDİR — alarm sessiz hatayı hedefler.
//   3) Seri, en yeni satırdan başlayıp ilk kuru-olmayan satırda kesilir; ESKİ biçimli satırlar
//      (v6.337 öncesi, `ilk=` etiketsiz) da sayılır → ilk koşuda geçmiş seri görünür.
//   4) Alarm eşikte bir kez + haftalık hatırlatma (üretimde e-posta açık — her gün değil).
// Fikstür satırları PROD audit zincirinden alınmış GERÇEK biçimlerdir (2026-09/10).
import { describe, it, expect } from "vitest";
import {
  describeError, dryStreak, firstErrorTag, isDrySegment, shouldAlertStreak, DRY_STREAK_THRESHOLD, DRY_STREAK_REMIND_EVERY,
  ageInDays, freshnessLine, isFullLocalScan, isSearchComplete, latestEvidence, localFeedDetail, shouldAlertStale,
  ICTIHAT_STALE_DAYS, ICTIHAT_STALE_REMIND_EVERY,
} from "@/lib/ingest-streak";

// v6.341: undici "fetch failed" asıl nedeni `cause` içinde taşır — 08.10 ilk ölçüm yalnız mesajı gördü.
describe("describeError: hata metni + asıl neden", () => {
  it("fetch hatasının cause.code'u köşeli parantezle eklenir", () => {
    const e = new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" }) });
    expect(describeError(e)).toBe("fetch failed [ECONNRESET]");
  });

  it("code yoksa cause.message kullanılır (tek satır, 60 karakterle sınırlı)", () => {
    const e = new TypeError("fetch failed", { cause: new Error("Connect Timeout Error\n  (attempted address: x)") });
    expect(describeError(e)).toBe("fetch failed [Connect Timeout Error (attempted address: x)]");
    const uzun = new Error("fetch failed", { cause: new Error("y".repeat(200)) });
    expect(describeError(uzun)).toBe(`fetch failed [${"y".repeat(60)}]`);
  });

  it("nedensiz hata ve hata-olmayan değer aynen döner; toplam 140 karakter", () => {
    expect(describeError(new Error("HTTP 403"))).toBe("HTTP 403");
    expect(describeError("düz metin")).toBe("düz metin");
    expect(describeError(new Error("z".repeat(300)))).toHaveLength(140);
  });

  it("firstErrorTag ile zincir: audit satırında neden görünür", () => {
    const e = new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    expect(firstErrorTag([`arama 'malpraktis': ${describeError(e)}`])).toBe(` ilk="arama 'malpraktis': fetch failed [UND_ERR_CONNECT_TIMEOUT]"`);
  });
});

const KURU_ESKI = "ictihat yeni=0/0 sorun=1 · doktrin yeni=0/32 · ttb atlandi(haftalik)";
const KURU_YENI = 'ictihat yeni=0/0 sorun=1 ilk="arama \'hekimin hukuki sorumluluğu\': HTTP 403" · doktrin yeni=0/32 · ttb atlandi(haftalik)';
const KISMI = "ictihat yeni=0/60 sorun=4 · doktrin yeni=0/33 · ttb atlandi(haftalik)";
const HATASIZ_BOS = "ictihat yeni=0/21 · doktrin yeni=0/0 · ttb atlandi(haftalik)";
const COKTU = "ictihat hata: fetch failed · doktrin hata: içerik okunamadı · ttb atlandi(haftalik)";
const DOKTRIN_KURU = "ictihat yeni=0/0 sorun=1 · doktrin yeni=0/0 sorun=1 · ttb yeni=1 guncel=29 devir=3/33";

describe("firstErrorTag: ilk hata metni audit satırına", () => {
  it("hata yoksa boş dize — detail biçimi değişmez", () => {
    expect(firstErrorTag([])).toBe("");
    expect(firstErrorTag(["  "])).toBe("");
  });

  it("ilk dolu hata tek satır, tırnaklı etiket olur", () => {
    expect(firstErrorTag(['arama "tıbbi hata": HTTP 403', "karar 12: metin boş"])).toBe(` ilk="arama 'tıbbi hata': HTTP 403"`);
  });

  it("segment ayracı ve satır kırığı ayıklanır — detail bölünebilir kalır", () => {
    const tag = firstErrorTag(["a · b\n  c"]);
    expect(tag).toBe(' ilk="a - b c"');
    expect(`ictihat yeni=0/0 sorun=1${tag} · doktrin yeni=0/1`.split(" · ")).toHaveLength(2);
  });

  it("120 karakterde kırpılır", () => {
    const tag = firstErrorTag(["x".repeat(500)]);
    expect(tag).toBe(` ilk="${"x".repeat(120)}"`);
  });
});

describe("isDrySegment: kuru koşu tanımı", () => {
  it("hiçbir şey bulunamadı + hata = kuru (eski ve yeni biçim)", () => {
    expect(isDrySegment(KURU_ESKI, "ictihat")).toBe(true);
    expect(isDrySegment(KURU_YENI, "ictihat")).toBe(true);
  });

  it("iş tamamen çöktü (`hata:`) = kuru", () => {
    expect(isDrySegment(COKTU, "ictihat")).toBe(true);
    expect(isDrySegment(COKTU, "doktrin")).toBe(true);
  });

  it("kısmi bulgu ve hatasız boşluk kuru DEĞİLDİR", () => {
    expect(isDrySegment(KISMI, "ictihat")).toBe(false);
    expect(isDrySegment(HATASIZ_BOS, "ictihat")).toBe(false);
    expect(isDrySegment(HATASIZ_BOS, "doktrin")).toBe(false);
  });

  it("segmentler birbirine karışmaz", () => {
    expect(isDrySegment(KURU_ESKI, "doktrin")).toBe(false); // doktrin 0/32, hatasız
    expect(isDrySegment(DOKTRIN_KURU, "doktrin")).toBe(true);
  });

  it("boş/ilgisiz satır kuru değildir", () => {
    expect(isDrySegment(null, "ictihat")).toBe(false);
    expect(isDrySegment("purge ok", "ictihat")).toBe(false);
  });
});

describe("dryStreak: ardışık kuru koşu sayısı", () => {
  it("en yeniden başlar, ilk kuru-olmayan satırda kesilir", () => {
    expect(dryStreak([KURU_YENI, KURU_ESKI, KURU_ESKI, KISMI, KURU_ESKI], "ictihat")).toBe(3);
  });

  it("en yeni satır kuru değilse seri 0", () => {
    expect(dryStreak([KISMI, KURU_ESKI, KURU_ESKI], "ictihat")).toBe(0);
  });

  it("segment başına ayrı sayılır", () => {
    expect(dryStreak([DOKTRIN_KURU, KURU_ESKI], "ictihat")).toBe(2);
    expect(dryStreak([DOKTRIN_KURU, KURU_ESKI], "doktrin")).toBe(1);
  });
});

describe("shouldAlertStreak: eşikte bir kez + haftalık hatırlatma", () => {
  it("eşiğin altında alarm yok", () => {
    for (let n = 0; n < DRY_STREAK_THRESHOLD; n++) expect(shouldAlertStreak(n)).toBe(false);
  });

  it("eşikte ve sonra her DRY_STREAK_REMIND_EVERY koşuda bir", () => {
    const fired = Array.from({ length: 30 }, (_, n) => n).filter(shouldAlertStreak);
    expect(fired).toEqual([
      DRY_STREAK_THRESHOLD,
      DRY_STREAK_THRESHOLD + DRY_STREAK_REMIND_EVERY,
      DRY_STREAK_THRESHOLD + 2 * DRY_STREAK_REMIND_EVERY,
      DRY_STREAK_THRESHOLD + 3 * DRY_STREAK_REMIND_EVERY,
    ]);
  });
});

// v6.343 (2026-10-10): Yargıtay içtihadı YEREL beslenir (karararama yurt dışı IP'lerini engelliyor) → cron yalnız
// tazelik nöbeti. Fikstürler 10.10 ilk dolumunun GERÇEK çıktısından: yazma koşusu 429 yedi, 7 sorgunun 3'ü tarandı.
describe("yerel besleme nabzı: tam / yarım tarama", () => {
  const yarim = { created: 4, found: 102, deferred: 0, errors: ['arama ""tıbbi uygulama hatası"": HTTP 429', "karar 1195426300: getDokuman: FMTY=ERROR"] };

  it("arama hatası taramayı YARIM yapar; tek karar metni hatası yapmaz", () => {
    expect(isSearchComplete(yarim.errors)).toBe(false);
    expect(isSearchComplete(["karar 1195426300: getDokuman: FMTY=ERROR"])).toBe(true);
    expect(isSearchComplete([])).toBe(true);
  });

  it("nabız satırı sayıları, ilk hatayı ve tarama durumunu taşır; segment ayracını bozmaz", () => {
    const d = localFeedDetail(yarim);
    expect(d.startsWith("yerel yeni=4/102 sorun=2 ilk=")).toBe(true);
    expect(d.endsWith(" tarama=yarim")).toBe(true);
    expect(d).not.toContain(" · ");
    expect(localFeedDetail({ created: 16, found: 513, deferred: 0, errors: [] })).toBe("yerel yeni=16/513 tarama=tam");
    expect(localFeedDetail({ created: 0, found: 513, deferred: 3, errors: [] })).toBe("yerel yeni=0/513 erteli=3 tarama=tam");
  });

  it("yalnız tam tarama nabız sayılır", () => {
    expect(isFullLocalScan("yerel yeni=0/513 tarama=tam")).toBe(true);
    expect(isFullLocalScan(localFeedDetail(yarim))).toBe(false);
    expect(isFullLocalScan("yerel yeni=1/2 tarama=tamam")).toBe(false);
    expect(isFullLocalScan(null)).toBe(false);
  });
});

describe("içtihat tazelik nöbeti", () => {
  const now = new Date("2026-10-24T02:20:00Z");
  const d = (iso: string) => new Date(iso);

  it("kanıt = nabız ile son kararın YENİSİ; hiçbiri yoksa null", () => {
    expect(latestEvidence(d("2026-10-10T06:00:00Z"), d("2026-10-10T01:30:00Z"))?.toISOString()).toBe("2026-10-10T06:00:00.000Z");
    expect(latestEvidence(null, d("2026-10-10T01:30:00Z"))?.toISOString()).toBe("2026-10-10T01:30:00.000Z");
    expect(latestEvidence(undefined, null)).toBeNull();
  });

  it("yaş tam gün, aşağı yuvarlanır; gelecek tarih 0", () => {
    expect(ageInDays(d("2026-10-10T02:20:00Z"), now)).toBe(14);
    expect(ageInDays(d("2026-10-10T02:21:00Z"), now)).toBe(13);
    expect(ageInDays(d("2026-10-25T00:00:00Z"), now)).toBe(0);
    expect(ageInDays(null, now)).toBeNull();
  });

  it("alarm eşikte bir kez + haftalık hatırlatma; kanıt yoksa her koşu", () => {
    expect(shouldAlertStale(ICTIHAT_STALE_DAYS - 1)).toBe(false);
    expect(shouldAlertStale(ICTIHAT_STALE_DAYS)).toBe(true);
    expect(shouldAlertStale(ICTIHAT_STALE_DAYS + 1)).toBe(false);
    expect(shouldAlertStale(ICTIHAT_STALE_DAYS + ICTIHAT_STALE_REMIND_EVERY)).toBe(true);
    expect(shouldAlertStale(0)).toBe(false);
    expect(shouldAlertStale(null)).toBe(true);
  });

  it("audit segmenti ASCII ve kuruma nöbetine KURU görünmez (seri kesilir)", () => {
    const line = freshnessLine(d("2026-10-10T01:30:00Z"), 13);
    expect(line).toBe("tazelik son=2026-10-10 (13 gun)");
    expect(freshnessLine(null, null)).toBe("tazelik son=yok");
    const detail = `ictihat ${line} · doktrin yeni=0/12 · ttb atlandi(haftalik)`;
    expect(isDrySegment(detail, "ictihat")).toBe(false);
    expect(dryStreak([detail, "ictihat yeni=0/0 sorun=1 · doktrin yeni=0/12"], "ictihat")).toBe(0);
  });
});

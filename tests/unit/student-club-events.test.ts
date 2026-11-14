import { describe, expect, it } from "vitest";
import { discoverStudentEventUrls, parseStudentClubEvent, scanStudentClubEvents } from "../../src/lib/student-club-events";
const now = new Date("2026-11-09T12:00:00Z");
const url = "https://sks.ogu.edu.tr/Etkinlik/Detay/3278/ornek";
const fixture = (date = "06 Aralık 2026", title = "Tıp Eğitimi Çalıştayı") => `<p>Etkinliği Düzenleyen : Türk Uluslararası Tıp Öğrencileri Birliği Kulübü</p><p>Başlangıç-Bitiş Tarihi: ${date}</p><p>Etkinlik Adı: ${title}</p><p>Tür : Eğitim</p><p>Yer: Tıp Fakültesi Amfisi</p><p>Son Güncelleme Tarihi: 4.11.2026</p><p>Genel iptal politikası</p>`;
describe("student club official discovery", () => {
  it("extracts dated official candidates without interpreting footer cancellation policy", () => {
    const event = parseStudentClubEvent(fixture().replaceAll("ü", "&uuml;").replaceAll("ç", "&ccedil;").replaceAll("Ö", "&Ouml;"), url, now)!;
    expect(event.startDay).toBe("2026-12-06"); expect(event.status).toBe("candidate"); expect(event.sourceUrl).toBe(url); expect(event.evidenceHash).toHaveLength(64);
  });
  it.each(["07 Kasım 2026", "31 Şubat 2027", "06-07 Aralık 2026", "yakında"])("rejects elapsed, invalid or unsupported date %s", date => expect(parseStudentClubEvent(fixture(date), url, now)).toBeNull());
  it("rejects cancellation, unrelated clubs, missing venues, and external URLs", () => {
    expect(parseStudentClubEvent(fixture(undefined, "İptal edilen toplantı"), url, now)).toBeNull();
    expect(parseStudentClubEvent("<h1>ETKİNLİK İPTAL EDİLMİŞTİR</h1>" + fixture(), url, now)).toBeNull();
    expect(parseStudentClubEvent(fixture().replace(/Tıp/g, "Mühendislik"), url, now)).toBeNull();
    expect(parseStudentClubEvent(fixture().replace("Tıp Fakültesi Amfisi", ""), url, now)).toBeNull();
    expect(parseStudentClubEvent(fixture(), "https://evil.example/Etkinlik/Detay/1/x", now)).toBeNull();
  });
  it("deduplicates URLs and rejects foreign origins and credentials", () => {
    expect(discoverStudentEventUrls(`<a href="${url}?utm_source=x"></a><a href="${url}#x"></a><a href="https://evil.example/Etkinlik/Detay/1/x"></a><a href="https://u:p@sks.ogu.edu.tr/Etkinlik/Detay/1/x"></a>`)).toEqual([url]);
  });
  it("fails closed on missing index and never fabricates events", async () => {
    const report = await scanStudentClubEvents(now, async () => { throw Error("secret detail"); });
    expect(report.complete).toBe(false); expect(report.candidates).toEqual([]); expect(JSON.stringify(report)).not.toContain("secret");
  });
  it("deduplicates repeated event detail records", async () => {
    const report = await scanStudentClubEvents(now, async source => source.endsWith("Index") ? `<a href="${url}"></a><a href="${url.replace("3278", "3279")}"></a>` : fixture());
    expect(report.checked).toBe(2); expect(report.candidates).toHaveLength(1);
  });
  it("uses Turkey's date boundary", () => expect(parseStudentClubEvent(fixture("09 Kasım 2026"), url, new Date("2026-11-09T21:01:00Z"))).toBeNull());
});

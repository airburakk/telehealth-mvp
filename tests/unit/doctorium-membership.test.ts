// Doctorium "Hesabım" — saf mantık sözleşmeleri (v6.187, kullanıcı kararı 2026-08-29).
//
// Burada kilitlenen iki şey:
//   1) Klinik bağ korkuluğu — tam hesap kapatmanın FAIL-CLOSED kapısı. Aşama 1 doktorunda ve
//      öğrencide bağ sıfır BEKLENİR ama VARSAYILMAZ; bağ varsa kapatma reddedilir ve kullanıcıya
//      "üyelikten çıkış" yolu sunulur.
//   2) User-Agent etiketi — giriş etkinliği listesinin okunabilirliği. Kural: tanınmayan UA ham
//      bırakılmaz (uzun ve okunmaz), spesifik tarayıcı genel olandan ÖNCE eşleşir.
import { describe, it, expect } from "vitest";
import { hasClinicalTies } from "@/lib/doctorium-membership";
import { describeUserAgent } from "@/lib/login-activity";

describe("Klinik bağ korkuluğu (v6.187): tam kapatma fail-closed", () => {
  it("bağ yoksa kapatma yolu açık", () => {
    expect(hasClinicalTies({ cases: 0, consultations: 0, reviews: 0 })).toBe(false);
  });
  it("tek bir vaka bile kapatmayı kapatır", () => {
    expect(hasClinicalTies({ cases: 1, consultations: 0, reviews: 0 })).toBe(true);
  });
  it("konsültasyon tek başına yeter", () => {
    expect(hasClinicalTies({ cases: 0, consultations: 1, reviews: 0 })).toBe(true);
  });
  it("değerlendirme tek başına yeter (üç eksenin de bağımsızlığı)", () => {
    expect(hasClinicalTies({ cases: 0, consultations: 0, reviews: 1 })).toBe(true);
  });
});

describe("Giriş etkinliği: User-Agent → okunabilir cihaz etiketi", () => {
  it("UA yoksa uydurmaz", () => {
    expect(describeUserAgent(null)).toBe("Bilinmeyen tarayıcı");
    expect(describeUserAgent("")).toBe("Bilinmeyen tarayıcı");
  });
  it("Chrome · Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    expect(describeUserAgent(ua)).toBe("Chrome · Windows");
  });
  it("🪤 Edge, Chrome'dan ÖNCE eşleşmeli (Edge UA'sı 'Chrome' da içerir)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0";
    expect(describeUserAgent(ua)).toBe("Edge · Windows");
  });
  it("🪤 Safari, Chrome'dan SONRA eşleşmeli (Chrome UA'sı 'Safari' de içerir)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(describeUserAgent(ua)).toBe("Safari · Mac");
  });
  it("🪤 iPad 'Macintosh' gibi görünse de iPad olarak etiketlenir", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(describeUserAgent(ua)).toBe("Safari · iPad");
  });
  it("iOS Chrome (CriOS) Chrome sayılır", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1";
    expect(describeUserAgent(ua)).toBe("Chrome · iPhone");
  });
  it("🪤 HeadlessChrome, Safari'ye DÜŞMEMELİ (word-boundary tuzağı — canlıda ölçüldü)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36";
    expect(describeUserAgent(ua)).toBe("Chrome · Windows");
  });
  it("platform tanınmazsa yalnız tarayıcı döner (yarım bilgi > yanlış bilgi)", () => {
    expect(describeUserAgent("Mozilla/5.0 (Unknown) Firefox/130.0")).toBe("Firefox");
  });
});

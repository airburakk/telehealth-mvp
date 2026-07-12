// navItemsFor — rol + hasta yolculuğu nav bileşimi matrisi (FAZ 2, 2026-07-04).
// Hasta nav kararı: PATIENT = Vakalarım · Post Op · Paylaşımlarım (Triyaj/Ücretsiz Sağlık Hizmeti/Doktorlar kalktı);
// SO yolculuğunda Paylaşımlarım gizli + Vakalarım SO listesine işaret eder.
import { describe, it, expect } from "vitest";
import { navItemsFor, effectiveNavJourney } from "@/lib/nav";

const hrefs = (role: string | null, journey?: string | null) => navItemsFor(role, journey).map((n) => n.href);

describe("navItemsFor", () => {
  it("PATIENT (journey yok): Vakalarım + Post Op + Paylaşımlarım; Triyaj/Ücretsiz Sağlık Hizmeti/Doktorlar YOK", () => {
    const h = hrefs("PATIENT", null);
    expect(h).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
    expect(h).not.toContain("/triyaj");
    expect(h).not.toContain("/ucretsiz-saglik/basvur");
    expect(h).not.toContain("/hekimler");
  });

  it("PATIENT + SECOND_OPINION: Paylaşımlarım gizli, Vakalarım → SO listesi", () => {
    const h = hrefs("PATIENT", "SECOND_OPINION");
    expect(h).toEqual(["/second-opinion/vakalarim", "/takip"]);
  });

  it("PATIENT + GENERAL/FREE_CARE: normal hasta nav'ı (SO daraltması yalnız SECOND_OPINION)", () => {
    expect(hrefs("PATIENT", "GENERAL")).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
    expect(hrefs("PATIENT", "FREE_CARE")).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
  });

  it("DOCTOR: değişmedi (Doktor, Post-Op, Ücretsiz Sağlık Hizmeti, Profilim); hasta sekmeleri yok", () => {
    expect(hrefs("DOCTOR")).toEqual(["/doktor", "/doktor/takip", "/doktor/ucretsiz-saglik", "/doktor/profil"]);
  });

  it("DOCTOR: journey parametresinden etkilenmez (yalnız PATIENT daraltması)", () => {
    expect(hrefs("DOCTOR", "SECOND_OPINION")).toEqual(hrefs("DOCTOR"));
  });

  it("COORDINATOR: Operasyon + Doktor + Post-Op + Ücretsiz Sağlık Hizmeti", () => {
    expect(hrefs("COORDINATOR")).toEqual(["/operasyon", "/doktor", "/doktor/takip", "/doktor/ucretsiz-saglik"]);
  });

  it("ADMIN: hasta sekmesi kaldırma ADMIN'i etkilemez (Triyaj/Doktorlar ADMIN'de kalır)", () => {
    const h = hrefs("ADMIN");
    expect(h).toContain("/triyaj");
    expect(h).toContain("/hekimler");
    expect(h).toContain("/vakalarim");
    expect(h).toContain("/paylasimlarim");
    expect(h).not.toContain("/takip"); // Post Op hub yalnız PATIENT (personel /doktor/takip kullanır)
  });

  it("ETHICS ve PARTNER: tek sekme; rol yoksa boş", () => {
    expect(hrefs("ETHICS")).toEqual(["/etik-kurul"]);
    expect(hrefs("PARTNER")).toEqual(["/partner"]);
    expect(hrefs(null)).toEqual([]);
  });
});

// Karma-kulvar düzeltmesi (2026-07-12): SO damgalı hastanın GENERAL vakası da varsa nav'daki
// SO daraltması (Vakalarım→SO, Paylaşımlarım gizli) uygulanmaz — layout journey'yi Header'a
// geçirmeden önce bu filtreden geçirir.
describe("effectiveNavJourney", () => {
  it("karma hasta (SO + genel vaka): journey null'a düşer → tam hasta nav'ı", () => {
    expect(effectiveNavJourney("SECOND_OPINION", true)).toBeNull();
    expect(hrefs("PATIENT", effectiveNavJourney("SECOND_OPINION", true))).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
  });

  it("saf-SO hastası: SO daraltması sürer (Vakalarım → SO listesi)", () => {
    expect(effectiveNavJourney("SECOND_OPINION", false)).toBe("SECOND_OPINION");
    expect(hrefs("PATIENT", effectiveNavJourney("SECOND_OPINION", false))).toEqual(["/second-opinion/vakalarim", "/takip"]);
  });

  it("SO-dışı damgalar aynen geçer; boş damga null olur", () => {
    expect(effectiveNavJourney("GENERAL", true)).toBe("GENERAL");
    expect(effectiveNavJourney("HEALTH_TOURISM", false)).toBe("HEALTH_TOURISM");
    expect(effectiveNavJourney(null, true)).toBeNull();
    expect(effectiveNavJourney(undefined, false)).toBeNull();
  });
});

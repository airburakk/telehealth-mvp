// navItemsFor — rol + hasta yolculuğu nav bileşimi matrisi (FAZ 2, 2026-07-04).
// Hasta nav kararı: PATIENT = Vakalarım · Post Op · Paylaşımlarım (Triyaj/Ücretsiz Sağlık Hizmeti/Doktorlar kalktı);
// SO yolculuğunda Paylaşımlarım gizli + Vakalarım SO listesine işaret eder.
import { describe, it, expect } from "vitest";
import { navItemsFor } from "@/lib/nav";

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

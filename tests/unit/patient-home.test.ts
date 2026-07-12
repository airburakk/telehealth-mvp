// patientHomeFor — dönen hasta iniş noktası karar matrisi (karma-kulvar düzeltmesi, 2026-07-12).
// Bug: patientJourney son-yazan-kazanır damga; SO damgalı ama GENERAL vakası da olan hasta
// SO silosuna iniyordu ve genel vakalarına UI'dan ulaşamıyordu. Kural: SO listesine yalnız
// SADECE-SO hastası iner; karma hasta /vakalarim'a.
import { describe, it, expect } from "vitest";
import { patientHomeFor } from "@/lib/patient-journey";

describe("patientHomeFor", () => {
  it("karma hasta (SO damgalı + GENERAL vakası var): /vakalarim — SO silosuna HAPSOLMAZ", () => {
    expect(patientHomeFor("SECOND_OPINION", 12, 10)).toBe("/vakalarim");
    expect(patientHomeFor("SECOND_OPINION", 1, 1)).toBe("/vakalarim");
  });

  it("saf-SO hastası (yalnız SO vakaları): SO listesine iner (3 Tem kararı korunur)", () => {
    expect(patientHomeFor("SECOND_OPINION", 0, 3)).toBe("/second-opinion/vakalarim");
  });

  it("SO damgalı ama hiç SO vakası yok (vaka silinmiş/taşınmış): genel kurala düşer", () => {
    expect(patientHomeFor("SECOND_OPINION", 2, 0)).toBe("/vakalarim");
    expect(patientHomeFor("SECOND_OPINION", 0, 0)).toBe("/triyaj");
  });

  it("GENERAL/turizm/ücretsiz damgalı hasta: vakası varsa /vakalarim (SO sayısı yönü değiştirmez)", () => {
    expect(patientHomeFor("GENERAL", 3, 0)).toBe("/vakalarim");
    expect(patientHomeFor("HEALTH_TOURISM", 1, 0)).toBe("/vakalarim");
    expect(patientHomeFor("FREE_CARE", 0, 2)).toBe("/vakalarim");
  });

  it("hiç başvurusu olmayan hasta: /triyaj (damga ne olursa olsun)", () => {
    expect(patientHomeFor(null, 0, 0)).toBe("/triyaj");
    expect(patientHomeFor("GENERAL", 0, 0)).toBe("/triyaj");
    expect(patientHomeFor(undefined, 0, 0)).toBe("/triyaj");
  });
});

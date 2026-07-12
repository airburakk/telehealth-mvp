// patientHomeFor — dönen hasta iniş noktası karar matrisi.
// Tam birleşme (2026-07-12, kullanıcı kararı): SO dahil tüm kulvarlar /vakalarim'da tek listede —
// journey-bazlı iniş ayrımı kalktı. Öncesi: SO silosu karma hastayı genel vakalarından koparıyordu
// (karma-kulvar bug'ı, aynı gün düzeltilip ardından tam birleşmeyle sadeleştirildi).
import { describe, it, expect } from "vitest";
import { patientHomeFor } from "@/lib/patient-journey";

describe("patientHomeFor", () => {
  it("başvurusu olan hasta /vakalarim'a iner — kulvar fark etmez (genel, SO, karma)", () => {
    expect(patientHomeFor(12, 10)).toBe("/vakalarim"); // karma
    expect(patientHomeFor(3, 0)).toBe("/vakalarim"); // yalnız genel
    expect(patientHomeFor(0, 3)).toBe("/vakalarim"); // yalnız SO — silo YOK, tek merkez
  });

  it("hiç başvurusu olmayan hasta /triyaj'a iner (giriş hunisi)", () => {
    expect(patientHomeFor(0, 0)).toBe("/triyaj");
  });
});

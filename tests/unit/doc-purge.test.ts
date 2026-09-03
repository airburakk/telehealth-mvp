// Doktor belge imhası — saf karar sözleşmeleri (2026-08-30, KVKK minimizasyonu kararı).
//
// Kilitlenenler:
//   1) Kapsam: yalnız DIPLOMA (kullanıcı kararı — MMSS/CERTIFICATE/ACADEMIC AURA kulvarının işi).
//   2) ACCEPTED → dosya silinir (verifiedSource fark etmez: EDEVLET/MANUAL/LEGACY — backfill bu
//      kuraldan doğar); PENDING → incelemeci için durur; REJECTED → 90 günlük ispat penceresi (v6.212, 👤 03.09.2026).
//   3) İdempotens: zaten imha edilmiş satır bir daha seçilmez.
import { describe, it, expect } from "vitest";
import { shouldPurgeDoc, REJECTED_RETENTION_DAYS, PURGE_DOC_TYPES } from "@/lib/doc-purge";
import { purgedRef, isPurgedRef } from "@/lib/storage";

const NOW = new Date("2026-08-30T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const doc = (over: Partial<{ type: string; status: string; content: string; createdAt: Date }>) => ({
  type: "DIPLOMA", status: "ACCEPTED", content: "blob:v1:https://x/y", createdAt: daysAgo(10), ...over,
});

describe("purged ref biçimi (storage ref ailesinin 4. üyesi)", () => {
  it("purgedRef ürettiğini isPurgedRef tanır ve tarihi taşır", () => {
    const ref = purgedRef(NOW);
    expect(isPurgedRef(ref)).toBe(true);
    expect(ref).toContain("2026-08-30");
  });
  it("diğer ref biçimleri imha sayılmaz", () => {
    for (const r of ["blob:v1:https://x/y", "enc:v1:abc", "data:application/pdf;base64,AAAA", ""]) {
      expect(isPurgedRef(r)).toBe(false);
    }
  });
});

describe("shouldPurgeDoc: imha karar matrisi", () => {
  it("kapsam yalnız DIPLOMA", () => {
    expect(PURGE_DOC_TYPES).toEqual(["DIPLOMA"]);
    for (const type of ["MMSS", "CERTIFICATE", "ACADEMIC"]) {
      expect(shouldPurgeDoc(doc({ type }), NOW)).toBe(false);
    }
  });
  it("ACCEPTED diploma silinir — doğrulama kaynağından bağımsız (LEGACY backfill dahil)", () => {
    expect(shouldPurgeDoc(doc({}), NOW)).toBe(true);
  });
  it("zaten imha edilmiş satır yeniden seçilmez (idempotens)", () => {
    expect(shouldPurgeDoc(doc({ content: purgedRef(NOW) }), NOW)).toBe(false);
  });
  it("PENDING durur — incelemeci dosyayı görmeli", () => {
    expect(shouldPurgeDoc(doc({ status: "PENDING" }), NOW)).toBe(false);
  });
  it("pencere 90 gün — 👤 03.09.2026 (belge 11 §C.3); 180'e dönüş bilinçli karar ister", () => {
    expect(REJECTED_RETENTION_DAYS).toBe(90);
  });
  it("REJECTED ispat penceresi içinde durur, penceresi dolunca silinir", () => {
    expect(shouldPurgeDoc(doc({ status: "REJECTED", createdAt: daysAgo(REJECTED_RETENTION_DAYS - 1) }), NOW)).toBe(false);
    expect(shouldPurgeDoc(doc({ status: "REJECTED", createdAt: daysAgo(REJECTED_RETENTION_DAYS + 1) }), NOW)).toBe(true);
  });
});

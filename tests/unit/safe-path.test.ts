// Birim testleri — lib/safe-path (açık-yönlendirme koruması) + onam kapısı çıkış nöbeti (2026-09-15).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { isSafeInternalPath } from "@/lib/safe-path";
import { isSafeNextPath } from "@/lib/oauth";

describe("isSafeInternalPath — açık yönlendirme koruması", () => {
  it("site-içi yolları kabul eder", () => {
    for (const p of ["/", "/doktor", "/onam?next=%2Fadmin", "/a/b?c=1#x"]) expect(isSafeInternalPath(p)).toBe(true);
  });
  it("protokol-göreli ve ters bölülü hedefleri reddeder (tarayıcı /\\host'u //host sayar)", () => {
    for (const p of ["//evil.com", "//evil.com/x", "/\\evil.com", "/\\\\evil.com", "/\\/evil.com"]) expect(isSafeInternalPath(p)).toBe(false);
  });
  it("mutlak URL, boş ve tanımsız değerleri reddeder", () => {
    for (const p of ["https://evil.com", "evil.com", "", undefined, null]) expect(isSafeInternalPath(p as never)).toBe(false);
  });
  it("OAuth isSafeNextPath aynı kuralı uygular (delegasyon)", () => {
    expect(isSafeNextPath("/x")).toBe(true);
    expect(isSafeNextPath("//evil.com")).toBe(false);
    expect(isSafeNextPath("/\\evil.com")).toBe(false);
  });
});

// Regresyon nöbeti (2026-09-15, üretimde ölçülen döngü): onam kapıları çıkışta App Router gezintisi
// (useRouter / router.push / replace / refresh) KULLANMAZ. /onam'daki Header <Link>'leri üretimde bayat çerezle ön-yüklenir,
// proxy'nin 307'si ön-yükleme önbelleğine yazılır, router.push o girdiyi kullanıp /onam'a geri döner → spinner döngüsü.
// Çıkış tek noktadan: leave-gate.ts leaveConsentGate (tam sayfa gezintisi).
describe("onam kapıları tam sayfa gezintisiyle çıkar (leaveConsentGate)", () => {
  const dir = join(process.cwd(), "src", "app", "onam");
  const gates = readdirSync(dir).filter((f) => f.endsWith(".tsx") && f !== "page.tsx");
  it("dört kapı bileşeni bulunur", () => {
    expect(gates.sort()).toEqual(["AuraConsentGate.tsx", "ConsentResign.tsx", "DoctoriumConsentGate.tsx", "StaffConsentGate.tsx"]);
  });
  it.each(gates)("%s: useRouter/router.push/replace/refresh yok, çıkış leaveConsentGate ile", (f) => {
    const src = readFileSync(join(dir, f), "utf8");
    expect(src).not.toMatch(/useRouter|router\.(push|replace|refresh)\(/);
    expect(src).toMatch(/leaveConsentGate\(/);
  });
});

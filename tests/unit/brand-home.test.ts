// brandRoleHome — giriş sonrası MARKA-DUYARLI iniş.
//
// NEDEN TEST (2026-08-29): kullanıcı canlıda buldu — doctorium.tr'den giriş yapan doktor AURA
// klinik paneline (/doktor) iniyordu, adres doctorium.tr'de kalırken sayfa AURA'ydı. Ayrışmada
// (2026-08-24) giriş KAPISI (/doctorium/giris), hasta reddi ve OAuth DÖNÜŞ url'i marka-duyarlı
// yapılmıştı; atlanan tek şey VARIŞ hedefiydi. roleHome() saf bir rol→rota tablosudur ve markayı
// bilmez, dolayısıyla üç giriş yolu (parola, Google, Apple) da AURA'ya iniyordu. Portal'a dönüş
// yalnız ?next=/doktor/doctorium taşıyan bağlantıda çalışıyordu — yer imi, e-posta linki ya da
// parametreyi düşüren bir OAuth turu varsayılana düşürüyordu.
//
// ⚠️ IS_DOCTORIUM_DEPLOY modül YÜKLENİRKEN hesaplanır (üst seviye const). Tek bir statik import
// iki deploy'u birden ölçemez → her senaryo stubEnv + resetModules + DİNAMİK import ister.
import { describe, it, expect, afterEach, vi } from "vitest";

async function loadRoles(brandMode: string) {
  vi.resetModules();
  vi.stubEnv("BRAND_MODE", brandMode);
  return import("@/lib/roles");
}

describe("brandRoleHome", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("Doctorium deploy'unda doktor PORTALA iner (canlı regresyon, 2026-08-29)", async () => {
    const { brandRoleHome } = await loadRoles("doctorium");
    expect(brandRoleHome("DOCTOR")).toBe("/doktor/doctorium");
  });

  it("AURA deploy'unda doktor klinik panelde kalır (davranış değişmedi)", async () => {
    const { brandRoleHome } = await loadRoles("");
    expect(brandRoleHome("DOCTOR")).toBe("/doktor");
  });

  it("BRAND_MODE tanınmayan bir değerse AURA davranışı sürer (fail-safe)", async () => {
    const { brandRoleHome } = await loadRoles("baska-bir-marka");
    expect(brandRoleHome("DOCTOR")).toBe("/doktor");
  });

  it("gözetim rolleri de portala iner — ADMIN + COORDINATOR (2. tur bulgusu)", async () => {
    // Kullanıcı admin@air.test ile girip "header'da AURA, footer'da Doctorium" bildirdi:
    // yönetici portalın içindeyken bile AURA inişi/logosu alıyordu. Portal layout'u zaten
    // "COORDINATOR/ADMIN gözetim erişimi geçer" diyor — iniş de buna uymalı.
    const { brandRoleHome } = await loadRoles("doctorium");
    for (const role of ["DOCTOR", "ADMIN", "COORDINATOR"] as const) {
      expect(brandRoleHome(role), role).toBe("/doktor/doctorium");
    }
  });

  it("portal DIŞINDAKİ roller markadan ETKİLENMEZ", async () => {
    const doctorium = await loadRoles("doctorium");
    const aura = await loadRoles("");
    // Bu roller Doctorium portalına giremez → kendi panellerine inmeye devam ederler.
    // ⚠️ Bilinen sınır: Doctorium deploy'unda doğrulanmamış PARTNER/AGENCY/HEALTH_PRO
    // /kayit/durum'a iner ve o rota AURA_ONLY_PREFIXES'te olduğu için AURA'ya 307'lenir —
    // ayrı bir karar (kullanıcıya bildirildi 2026-08-29).
    for (const role of ["ETHICS", "PARTNER", "AGENCY", "HEALTH_PRO", "PATIENT"] as const) {
      expect(doctorium.brandRoleHome(role), role).toBe(aura.brandRoleHome(role));
    }
  });

  it("tıp öğrencisi de DOCTOR rolündedir → o da portala iner", async () => {
    // studentTrack hesapları ayrı bir rol taşımaz (lib/roles ROLES listesinde öğrenci yoktur);
    // Doctorium'a ait olmaları rolden değil markadan gelir — bu yüzden aynı dal onları da kapsar.
    const { brandRoleHome } = await loadRoles("doctorium");
    expect(brandRoleHome("DOCTOR")).toBe("/doktor/doctorium");
  });
});

describe("deniedRoleHome — rol kapısında reddedilen kullanıcının inişi (v6.203, QA ISSUE-A2)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("Doctorium deploy'unda /admin'e giden doktor PORTALA iner, landing'e değil", async () => {
    const { deniedRoleHome } = await loadRoles("doctorium");
    expect(deniedRoleHome("DOCTOR")).toBe("/doktor/doctorium");
  });

  it("AURA deploy'unda rolün kendi ana sayfasına iner (kök değil)", async () => {
    const { deniedRoleHome } = await loadRoles("");
    expect(deniedRoleHome("DOCTOR")).toBe("/doktor");
    expect(deniedRoleHome("PATIENT")).toBe("/triyaj");
    expect(deniedRoleHome("PARTNER")).toBe("/partner");
  });

  it("tanınmayan rol köke iner (fail-closed — eski davranış korunur)", async () => {
    const { deniedRoleHome } = await loadRoles("doctorium");
    expect(deniedRoleHome("SUPERUSER")).toBe("/");
    expect(deniedRoleHome(undefined)).toBe("/");
  });

  it("iniş hedefi o rolün GEÇEBİLDİĞİ bir kapıdır — yönlendirme döngüsü olmaz (iki deploy)", async () => {
    // proxy.ts rol kapıları (2026-09-02): /doktor → DOCTOR/COORDINATOR/ADMIN · /operasyon →
    // COORDINATOR/ADMIN · /partner → PARTNER/ADMIN · /acente → AGENCY/ADMIN · /uzman →
    // HEALTH_PRO/ADMIN · /etik-kurul → ETHICS/ADMIN. Kapı listesi değişirse burası da güncellenir.
    const gates: Record<string, string[]> = {
      "/doktor": ["DOCTOR", "COORDINATOR", "ADMIN"],
      "/operasyon": ["COORDINATOR", "ADMIN"],
      "/partner": ["PARTNER", "ADMIN"],
      "/acente": ["AGENCY", "ADMIN"],
      "/uzman": ["HEALTH_PRO", "ADMIN"],
      "/etik-kurul": ["ETHICS", "ADMIN"],
    };
    for (const mode of ["doctorium", ""]) {
      const { deniedRoleHome } = await loadRoles(mode);
      for (const role of ["DOCTOR", "COORDINATOR", "ADMIN", "PARTNER", "AGENCY", "HEALTH_PRO", "ETHICS"] as const) {
        const home = deniedRoleHome(role);
        const gate = Object.keys(gates).find((p) => home === p || home.startsWith(`${p}/`));
        if (gate) expect(gates[gate], `${mode || "aura"}: ${role} → ${home}`).toContain(role);
      }
    }
  });
});

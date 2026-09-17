// Regresyon nöbeti (2026-09-17) — çerezi değiştiren/silen bir uca fetch ATAN istemci dosyaları, sonrasında App Router
// gezintisi (router.push/replace) KULLANMAZ; tam sayfa gezinti (window.location) şarttır.
//
// Neden: v6.270 (onam döngüsü) — sayfadaki <Link> ön-yüklemeleri ESKİ çerezle alınmış proxy 307/RSC yüklerini önbelleğe
// koyar; çerez değiştikten sonra router.push o girdileri kullanır (yanlış sayfa, döngü, çıkıştan sonra kapılı sayfa
// yükü). Giriş/kayıt/master akışları zaten window.location kullanıyordu; 2026-09-17'de çıkış, tüm-cihazlardan-çıkış,
// üyelik kapatma ve onboarding bitişi de aynı kurala çekildi. Onam kapıları: tests/unit/safe-path.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// [dosya, çerez değiştiren uç] — fetch(uç) geçen dosyada router.push/replace hiç olmamalı.
const CASES: Array<[string, string]> = [
  ["src/components/Header.tsx", "/api/auth/logout"],
  ["src/app/doktor/doctorium/hesap/LogoutAllButton.tsx", "/api/auth/logout-all"],
  ["src/app/doktor/doctorium/hesap/MembershipPanel.tsx", "/api/doctorium/membership"],
  ["src/app/doktor/baslangic/OnboardingForm.tsx", "/api/doctor/onboarding"],
  ["src/components/aura/gate-email-form.tsx", "/api/auth/login"],
  ["src/components/DoctorSignupForm.tsx", "/api/auth/signup"],
  ["src/components/PatientSignupForm.tsx", "/api/auth/signup-patient"],
  ["src/components/StaffSignupForm.tsx", "/api/auth/signup-staff"],
  ["src/components/StudentGateForm.tsx", "/api/auth/signup-student"],
  ["src/components/TrialSignupForm.tsx", "/api/auth/signup-trial"],
  ["src/components/MasterBar.tsx", "/api/master/stop"],
  ["src/app/master/MasterPanel.tsx", "/api/master/impersonate"],
];

describe("çerez değiştiren uçtan sonra tam sayfa gezinti (router.push/replace yasak)", () => {
  it.each(CASES)("%s (%s)", (file, endpoint) => {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    expect(src, `${file} artık ${endpoint} çağırmıyor — tabloyu güncelle`).toContain(endpoint);
    expect(src).not.toMatch(/router\.(push|replace)\(/);
    expect(src).toMatch(/window\.location\.(assign|replace)\(/);
  });

  // Açık yönlendirme (CWE-601) nöbeti: URL'den gelen ?next tam sayfa gezintiye SÜZGEÇSİZ verilmez (2026-09-17 bulgusu —
  // e-posta giriş formu `/giris?next=//evil.com` ile dış siteye gidiyordu; OAuth start uçları zaten isSafeNextPath ile süzüyordu).
  it("gate-email-form: ?next isSafeInternalPath ile süzülür", () => {
    const src = readFileSync(join(process.cwd(), "src/components/aura/gate-email-form.tsx"), "utf8");
    expect(src).toMatch(/isSafeInternalPath\(/);
    expect(src).not.toMatch(/window\.location\.assign\(\s*sp\.get\(/);
  });
});

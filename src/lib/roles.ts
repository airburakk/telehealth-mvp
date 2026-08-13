// Rol sabitleri — SIR İÇERMEZ, client bileşenleri güvenle import edebilir.
//
// ⚠️ NEDEN AYRI DOSYA (2026-07-31): bu sabitler eskiden lib/session.ts'teydi. session.ts modül
// yüklenirken `resolveSessionSecret()` çalıştırır ve ÜRETİMDE SESSION_SECRET yoksa THROW eder.
// Tarayıcıda o değişken doğal olarak tanımsızdır → sadece bir rol etiketi için session.ts import
// eden bir "use client" bileşeni, ÜRETİMDE sayfayı komple çökertir (master paneli böyle kırıldı;
// dev'de kontrol yalnız uyarı verdiği için fark edilmiyordu — bkz. [[master-account-impersonation]]).
//
// KURAL: client bileşeninden rol sabiti lazımsa BURADAN al, `@/lib/session`'dan DEĞİL.
// session.ts bunları geriye uyum için yeniden dışa verir (sunucu tarafı importlar değişmedi).

export const ROLES = ["PATIENT", "DOCTOR", "COORDINATOR", "ETHICS", "ADMIN", "PARTNER", "AGENCY", "HEALTH_PRO"] as const;
export type Role = (typeof ROLES)[number];

// Kurumsal üyelik yaşam döngüsü (2026-08-12): PARTNER / AGENCY / HEALTH_PRO self-signup başvurusuyla
// açılır (User.staffVerifiedAt=null) ve İNSAN ONAYI (admin/personel-onay) gelene dek rol panelleri
// kapalıdır. COORDINATOR/ETHICS başvuru ALMAZ — yalnız davet (scripts/create-staff.ts).
// HEALTH_PRO = doktor-dışı sağlık profesyoneli (hemşire, fizyoterapist, psikolog, diyetisyen...);
// bu fazda KLİNİK YETKİSİ YOK — vaka erişimi ayrı kullanıcı kararıyla tasarlanacak.
export const STAFF_SIGNUP_ROLES = ["PARTNER", "AGENCY", "HEALTH_PRO"] as const;
export type StaffSignupRole = (typeof STAFF_SIGNUP_ROLES)[number];

export function isStaffSignupRole(v: unknown): v is StaffSignupRole {
  return typeof v === "string" && (STAFF_SIGNUP_ROLES as readonly string[]).includes(v);
}

// DB `role` kolonu şemada denetimsiz String (enum değil) — malformed/typo/gelecek değer olabilir.
// getCurrentUser bu guard'la doğrular; tanınmayan rol otoriter kabul edilmez (fail-closed).
export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
  AGENCY: "Sağlık Turizmi Acentesi",
  HEALTH_PRO: "Sağlık Uzmanı",
};

export function roleHome(role: Role): string {
  if (role === "COORDINATOR") return "/operasyon"; // S2 operasyon paneli
  if (role === "DOCTOR") return "/doktor";
  if (role === "ETHICS") return "/etik-kurul";
  if (role === "PARTNER") return "/partner"; // M5 Faz 3 — Partner Doktor alanı
  if (role === "AGENCY") return "/acente"; // S3 Sağlık Turizmi Acentesi — tedavi dosyaları kuyruğu (FAZ 4)
  if (role === "HEALTH_PRO") return "/uzman"; // Sağlık Uzmanı başlangıç paneli (klinik yetki yok — 2026-08-12)
  if (role === "PATIENT") return "/triyaj"; // hasta: doğrudan Branş Doktoru akışı (/basla 4'lü seçimi kaldırıldı 2026-07-12; diğer kulvarlar kendi sayfalarından)
  if (role === "ADMIN") return "/doktor"; // yönetici: personel gözetim inişi (/doktor isStaffOnly dalı — tüm kuyruk; eski fallback /vakalarim hasta rotasıydı)
  return "/vakalarim"; // tanınmayan rol (isRole fail-closed olduğundan pratikte erişilmez)
}

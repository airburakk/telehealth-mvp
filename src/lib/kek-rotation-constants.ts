// Break-glass KEK rotasyonu — İSTEMCİYE GÜVENLİ sabitler (import'suz). lib/kek-rotation.ts Node `crypto`
// çektiği için client bileşeni (app/admin/KekRotationPanel) yalnız bu modülü import eder.
/** APPLY için operatörün aynen yazması gereken onay ifadesi. */
export const CONFIRM_PHRASE = "ROTASYON";
/** Ucu uyandıran env adı — Vercel'de yazılır (yazma yetkisi = ikinci faktör), iş bitince kaldırılır. */
export const KEK_ROTATION_SECRET_ENV = "KEK_ROTATION_SECRET";

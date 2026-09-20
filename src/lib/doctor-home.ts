// M5 — Doktor Ana Sayfası pencere görünürlük kararı (tek kaynak).
// Ana Sayfa UI'si ve onboarding kapısı bu yardımcıları ortak kullanır ki kurallar tek yerde dursun.
//
// 5 pencere (Haberler 2026-07-31'de pencerelikten çıktı → üst bant linki + /doktor/haberler sayfası):
//   1) Klinik Nöbet      — HER doktorda (her zaman; onboarding'de "Uzaktan Sağlık Paneli" adıyla anlatılır)
//   2) İkinci Görüş (SO)  — Prof./Doç. ünvanı VE soOptIn (v6.105: ünvan kapısına tercih EKLENDİ)
//   3) Ücretsiz Sağlık Hizmeti          — yalnız freeCareOptIn=true (onboarding'de seçilir; sonra /doktor/profil'den açılabilir)
//   4) Konsültasyon Tal. — yalnız consultOptIn=true (Partner doktordan gelen anonim talepler; yanıt başına ödeme)
//   5) Sağlık Turizmi    — yalnız tourismOptIn=true (v6.105: önce KOŞULSUZ açıktı — kullanıcı kararı
//                          2026-08-17 ile tercihe bağlandı; migration mevcut doktorları true damgalar):
//                          kendi branş havuzuna düşen sağlık turizmi talepleri; doktor tanıtım mesajı +
//                          video randevu teklifi gönderir (2026-07-14)

import type { QueueCounterKey } from "@/lib/case-access";

// ── Vaka kuyruğu sayaç SÖZLÜĞÜ (kontrol raporu 2026-09-17 D02, v6.281) ──
// Eski üçlü ("Toplam vaka · Bekleyen · Acil (4-5)") kapsamını açıklamıyordu: "Acil" tamamlanmış vakaları da
// sayıyor, "Bekleyen" yalnız NEW'i sayarken İkinci Görüş paneli ayrı bir "bekliyor" gösteriyordu → farklı
// kapsamlar aynı iş önceliği izlenimi veriyordu. Dört sayaç, her birinin kapsamı ALT YAZIDA; sayılar
// lib/case-access `queueCounterWhere` ile SUNUCUDA hesaplanır (filtre = aynı where). Bu sözlük istemci
// bileşene (CaseQueue) de gider — burada Prisma çalışma zamanı bağımlılığı YOK (yalnız tip).
export const QUEUE_COUNTERS: Record<QueueCounterKey, { label: string; caption: string; tone?: string }> = {
  open: { label: "Açık vaka", caption: "Yeni · incelemede · görüşmede — arşiv hariç" },
  pending: { label: "İşlem bekleyen", caption: "Üstlenilmemiş yeni + incelemedeki dosyalar", tone: "text-blue-300" },
  urgent: { label: "Aktif acil", caption: "Aciliyet 4-5, yalnız açık vakalar", tone: "text-red-300" },
  archive: { label: "Arşiv", caption: "Tamamlanan vakalar", tone: "text-emerald-300" },
};

// İkinci Görüş ünvan kapısı: yalnız doçent/profesör.
// Doctor.title değerleri: "Prof. Dr." | "Doç. Dr." | "Op. Dr." | "Uzm. Dr."
export function soEligible(title: string | null | undefined): boolean {
  if (!title) return false;
  return /^(prof\.|doç\.|doc\.)/i.test(title.trim());
}

export interface DoctorPanelFields {
  title: string | null;
  freeCareOptIn: boolean;
  consultOptIn: boolean;
  // v6.105 — ZORUNLU alanlar (deletionLockedAt/CaseRef deseni, kasıtlı): çağıran select'ine
  // eklemeyi unutursa DERLEME kırılır. Aksi hâlde kapı sessizce "kapalı" karar verip doktorun
  // havuzunu düşürürdü — panel görünürlüğü sessiz yanlışa tahammül etmez.
  soOptIn: boolean;
  tourismOptIn: boolean;
}

export interface PanelVisibility {
  duty: true; // her zaman — Uzaktan Sağlık doktorun ana kulvarıdır, kapatılamaz
  so: boolean; // ünvan kapısı VE opt-in (ikisi birlikte)
  freeCare: boolean; // opt-in
  consult: boolean; // opt-in
  tourism: boolean; // opt-in (v6.105 öncesi koşulsuz açıktı)
}

// Doktorun Ana Sayfa pencerelerinin görünürlüğü. duty daima açık; diğer dördü tercihe bağlı.
// ⚠️ so'da İKİ şart BİRLİKTE aranır: ünvanı uygun olmayan doktorun soOptIn'i true olsa bile panel
// AÇILMAZ. Migration mevcut satırların hepsini true damgaladığı için gerçek kapı soEligible'dır.
export function panelVisibility(doc: DoctorPanelFields): PanelVisibility {
  return {
    duty: true,
    so: soEligible(doc.title) && !!doc.soOptIn,
    freeCare: !!doc.freeCareOptIn,
    consult: !!doc.consultOptIn,
    tourism: !!doc.tourismOptIn,
  };
}

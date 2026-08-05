// Etik Kurul & Tahkim — sabitler ve yardımcılar (Modül 7)

export const BOARD = [
  { name: "Prof. Dr. Av. Selim Aydın", role: "Sağlık Hukuku" },
  { name: "Prof. Dr. Nalan Erseven", role: "Tıp Etiği / Cerrahi" },
  { name: "Doç. Dr. Murat Kılıç", role: "Onkoloji" },
];

export const REQUEST_TYPES: Record<string, string> = {
  REFUND: "Ücret iadesi",
  DOCTOR_CHANGE: "Doktor değişimi",
  HOSPITAL_CHANGE: "Hastane değişimi",
  OTHER: "Diğer / şikayet",
};

// Hastanın bildirdiği ilgili/karşı taraf (v6.79) — kurulun savunma/bilgi talebi bu tarafa
// yönlenir (lib/system-messages). HOSPITAL/OTHER platformda hesabı olmayan taraflardır →
// talep koordinatöre düşer (S2 operasyon iletişimi yürütür; kullanıcı kararı 2026-08-05).
export const RESPONDENT_TYPES: Record<string, string> = {
  DOCTOR: "Doktor",
  AGENCY: "Sağlık turizmi acentesi",
  HOSPITAL: "Hastane yetkilisi",
  OTHER: "Platform / diğer",
};

// Savunma talebi karar kilidi (gün): açık talep varken kurul karar VEREMEZ — yanıt gelince
// VEYA süre dolunca kendiliğinden açılır (zaman-bazlı hesap, cron gerektirmez).
export const DEFENSE_LOCK_DAYS = 3;

export const VERDICTS: Record<string, { label: string; color: string }> = {
  FAVOR: { label: "Hasta lehine", color: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25" },
  PARTIAL: { label: "Kısmen kabul", color: "bg-amber-500/15 text-amber-200 ring-amber-400/25" },
  REJECT: { label: "Reddedildi", color: "bg-[var(--c-ink)]/10 text-[var(--c-ink-2)] ring-white/15" },
};

export const ACTIONS: Record<string, string> = {
  REFUND_FULL: "Tam ücret iadesi (Escrow)",
  REFUND_PARTIAL: "Kısmi ücret iadesi (Escrow)",
  SUPPLIER_CHANGE: "Doktor/hastane değişimi",
  ACCREDITATION_WARN: "Tedarikçiye akreditasyon uyarısı",
  NONE: "Yaptırım yok",
};

export const COMPLAINT_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Beklemede", color: "bg-amber-500/15 text-amber-200" },
  RESOLVED: { label: "Karara bağlandı", color: "bg-emerald-500/15 text-emerald-300" },
};

export const ESCROW_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  HELD: { label: "Emanette tutuluyor", color: "bg-amber-500/15 text-amber-300 ring-amber-400/25", dot: "bg-amber-500" },
  RELEASED: { label: "Taraflara aktarıldı", color: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25", dot: "bg-emerald-500" },
  REFUNDED: { label: "Hastaya iade edildi", color: "bg-[var(--c-accent)]/15 text-[var(--c-accent)] ring-[var(--c-accent)]/25", dot: "bg-[var(--c-accent)]" },
};

/// Anonimleştirme (data masking): kurul kimliği değil, vakayı görür
export function maskCaseId(caseId: string): string {
  return "Hasta #" + caseId.slice(0, 6).toUpperCase();
}

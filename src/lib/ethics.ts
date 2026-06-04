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

export const VERDICTS: Record<string, { label: string; color: string }> = {
  FAVOR: { label: "Hasta lehine", color: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  PARTIAL: { label: "Kısmen kabul", color: "bg-amber-100 text-amber-800 ring-amber-200" },
  REJECT: { label: "Reddedildi", color: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export const ACTIONS: Record<string, string> = {
  REFUND_FULL: "Tam ücret iadesi (Escrow)",
  REFUND_PARTIAL: "Kısmi ücret iadesi (Escrow)",
  SUPPLIER_CHANGE: "Doktor/hastane değişimi",
  ACCREDITATION_WARN: "Tedarikçiye akreditasyon uyarısı",
  NONE: "Yaptırım yok",
};

export const COMPLAINT_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Beklemede", color: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "Karara bağlandı", color: "bg-emerald-100 text-emerald-700" },
};

export const ESCROW_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  HELD: { label: "Emanette tutuluyor", color: "bg-amber-100 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  RELEASED: { label: "Taraflara aktarıldı", color: "bg-emerald-100 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  REFUNDED: { label: "Hastaya iade edildi", color: "bg-sky-100 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
};

/// Anonimleştirme (data masking): kurul kimliği değil, vakayı görür
export function maskCaseId(caseId: string): string {
  return "Hasta #" + caseId.slice(0, 6).toUpperCase();
}

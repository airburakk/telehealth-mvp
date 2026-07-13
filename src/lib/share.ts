// Güvenli Dijital Sağlık Paylaşımı (Modül 4) — saf yardımcılar (istemci-güvenli; node importu YOK)
// Hasta, kendi verisini süreli/iptal edilebilir token-linki ile yurt dışındaki doktoruna paylaşır.

export type ScopeKey = "EPIKRIZ" | "RADYOLOJI" | "LAB" | "GORUSME_NOTU";

export interface ScopeDef {
  key: ScopeKey;
  label: string;
  desc: string;
  icon: string; // lucide ikon adı — UI tarafında eşlenir
}

export const SCOPES: ScopeDef[] = [
  { key: "EPIKRIZ", label: "Epikriz / Özet Rapor", desc: "Tanı, branş ve triyaj değerlendirmesi", icon: "FileText" },
  { key: "RADYOLOJI", label: "Radyoloji Görüntüleri", desc: "MR / BT / röntgen (DICOM)", icon: "ScanLine" },
  { key: "LAB", label: "Laboratuvar Sonuçları", desc: "Kan tahlilleri, patoloji", icon: "FlaskConical" },
  { key: "GORUSME_NOTU", label: "Görüşme Notları", desc: "Doktorun konsültasyon (SOAP) notları", icon: "Stethoscope" },
];

export function scopeLabel(key: string): string {
  return SCOPES.find((s) => s.key === key)?.label ?? key;
}
export function scopeDef(key: string): ScopeDef | undefined {
  return SCOPES.find((s) => s.key === key);
}

export interface DurationOpt {
  key: string;
  label: string;
  hours: number | null; // null = süresiz
}

export const DURATIONS: DurationOpt[] = [
  { key: "24h", label: "24 saat", hours: 24 },
  { key: "7d", label: "7 gün", hours: 24 * 7 },
  { key: "30d", label: "30 gün", hours: 24 * 30 },
  { key: "never", label: "Süresiz", hours: null },
];

export function durationLabel(key: string): string {
  return DURATIONS.find((d) => d.key === key)?.label ?? key;
}

export function expiryFromKey(key: string): Date | null {
  const opt = DURATIONS.find((d) => d.key === key);
  if (!opt || opt.hours == null) return null;
  return new Date(Date.now() + opt.hours * 3_600_000);
}

export type ShareState = "ACTIVE" | "EXPIRED" | "REVOKED";

export function shareState(link: { expiresAt: Date | string | null; revokedAt: Date | string | null }): ShareState {
  if (link.revokedAt) return "REVOKED";
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return "ACTIVE";
}

export const SHARE_STATE_META: Record<ShareState, { label: string; badge: string; dot: string }> = {
  ACTIVE: { label: "Aktif", badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25", dot: "bg-emerald-500" },
  EXPIRED: { label: "Süresi doldu", badge: "bg-[var(--c-ink)]/10 text-[var(--c-ink-2)] ring-white/15", dot: "bg-[var(--c-ink)]/30" },
  REVOKED: { label: "İptal edildi", badge: "bg-red-500/15 text-red-300 ring-red-400/25", dot: "bg-red-500" },
};

// ── Paylaşılan veri kalemleri — vaka + seçilen scope'lardan türetilir (görüntüleyici için) ──

export interface SharedItem {
  scope: ScopeKey;
  kind: "report" | "image" | "lab" | "note";
  title: string;
  body?: string; // rapor/not metni
  fileName?: string; // görüntü/dosya adı
  rows?: { k: string; v: string }[]; // lab tablosu
}

export interface CaseForShare {
  patientName: string;
  branch: string;
  symptoms: string;
  reasoning: string;
  urgency: number;
  attachments: string | null;
  labResults?: string | null; // FHIR lab sonuçları (LOINC JSON) — paylaşımda GERÇEK lab tablosu
  dischargeReport?: string | null; // kayıtlı AI epikrizi (varsa EPIKRIZ kapsamında gerçek rapor)
  consultations?: { notes: string }[];
}

export function buildSharedItems(c: CaseForShare, scopes: string[]): SharedItem[] {
  const items: SharedItem[] = [];
  const files = (c.attachments ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (scopes.includes("EPIKRIZ")) {
    // Doktor AI epikriz oluşturduysa gerçek raporu göster; yoksa triyaj verisinden özet türet.
    const body = c.dischargeReport?.trim()
      ? c.dischargeReport
      : `Hasta: ${c.patientName}\n` +
        `Branş: ${c.branch}\n` +
        `Aciliyet: ${c.urgency}/5\n\n` +
        `Şikâyet / Semptomlar:\n${c.symptoms}\n\n` +
        `Triyaj Değerlendirmesi:\n${c.reasoning}\n\n` +
        `(Not: Doktor henüz nihai epikriz oluşturmadı — bu, triyaj verisinden türetilmiş ön özettir.)`;
    items.push({ scope: "EPIKRIZ", kind: "report", title: "Epikriz / Özet Rapor", body });
  }

  if (scopes.includes("RADYOLOJI")) {
    // Yalnız vakaya gerçekten yüklenmiş görüntü dosyaları — yoksa kalem GİZLENİR (placeholder/sahte yok).
    const imgs = files.filter((f) => /\.(dcm|dicom|jpe?g|png|bmp|tiff?)$/i.test(f));
    imgs.forEach((f) => items.push({ scope: "RADYOLOJI", kind: "image", title: "Radyoloji Görüntüsü", fileName: f }));
  }

  if (scopes.includes("LAB")) {
    // GERÇEK lab sonuçları (Case.labResults — LOINC JSON, kokpitten/AI ile girilmiş). Yoksa kalem
    // GİZLENİR — sahte klinik değer gösterilmez (demoda güven-öldürür / diligence riski).
    let rows: { k: string; v: string }[] = [];
    try {
      const arr = (c.labResults ? JSON.parse(c.labResults) : []) as { name?: string; value?: string | number; unit?: string }[];
      if (Array.isArray(arr)) {
        rows = arr
          .filter((r) => r && (r.name || r.value != null))
          .map((r) => ({ k: String(r.name ?? "—"), v: `${r.value ?? ""}${r.unit ? " " + r.unit : ""}`.trim() }))
          .filter((r) => r.v);
      }
    } catch { rows = []; }
    if (rows.length) {
      items.push({ scope: "LAB", kind: "lab", title: "Laboratuvar Sonuçları", rows });
    }
  }

  if (scopes.includes("GORUSME_NOTU")) {
    const notes = (c.consultations ?? []).filter((x) => x.notes?.trim());
    if (notes.length) {
      notes.forEach((n) => items.push({ scope: "GORUSME_NOTU", kind: "note", title: "Görüşme Notu (SOAP)", body: n.notes }));
    } else {
      items.push({ scope: "GORUSME_NOTU", kind: "note", title: "Görüşme Notu", body: "Henüz konsültasyon notu girilmemiş." });
    }
  }

  return items;
}

// Doktor şifre-açma çerez ön eki (görüntüleyici sayfası bu çerezi kontrol eder)
export const SHARE_UNLOCK_PREFIX = "air_share_";

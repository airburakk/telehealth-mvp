// Lojistik Patient Journey — sağlık turizmi rezervasyonunun aşama takibi (todo #373).
// Booking.journeyData (JSON JourneyStage[]) tek kaynağı; hasta-yüzü (rezervasyon sayfası) +
// koordinatör paneli (/operasyon/lojistik) + API paylaşır. İkonlar UI'da map edilir (bu modül UI-bağımsız).

export type JourneyStatus = "pending" | "active" | "done";

export interface JourneyStage {
  key: string;
  status: JourneyStatus;
  plannedAt?: string | null; // ISO tarih — planlanan
  doneAt?: string | null; // ISO tarih — gerçekleşen
  note?: string | null; // lojistik not (uçuş no, otel adı, transfer saati vb.)
}

// 5 aşama — mevcut rezervasyon "Hasta Yolculuğu" sırasıyla birebir aynı (tek kaynağa taşındı).
export const JOURNEY_STAGES: { key: string; label: string; desc: string }[] = [
  { key: "transfer", label: "Karşılama & transfer", desc: "Havalimanı VIP karşılama" },
  { key: "hotel", label: "Otel girişi", desc: "Konaklama başlangıcı" },
  { key: "hospital", label: "Hastane & ön muayene", desc: "Tetkik ve hazırlık" },
  { key: "operation", label: "Operasyon / tedavi", desc: "Planlanan işlem" },
  { key: "discharge", label: "Taburcu & dönüş", desc: "Kontroller + uçuş" },
];

export const JOURNEY_STAGE_KEYS = JOURNEY_STAGES.map((s) => s.key);

// Durum → etiket + Tailwind renk sınıfları (ESCROW_STATUS deseni, lib/ethics.ts).
export const JOURNEY_STATUS: Record<JourneyStatus, { label: string; color: string; dot: string }> = {
  pending: { label: "Bekliyor", color: "bg-[var(--c-ink)]/10 text-[var(--c-ink-2)] ring-white/15", dot: "bg-[var(--c-ink)]/20" },
  active: { label: "Devam ediyor", color: "bg-[var(--c-accent)]/15 text-[var(--c-accent)] ring-[var(--c-accent)]/25", dot: "bg-[var(--c-accent)]" },
  done: { label: "Tamamlandı", color: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25", dot: "bg-emerald-500" },
};

export function isJourneyStatus(s: unknown): s is JourneyStatus {
  return s === "pending" || s === "active" || s === "done";
}

// Varsayılan yolculuk — booking oluşturulurken init + null/bozuk journeyData fallback'i.
// İlk aşama "active", gerisi "pending".
export function defaultJourney(): JourneyStage[] {
  return JOURNEY_STAGES.map((s, i) => ({
    key: s.key,
    status: (i === 0 ? "active" : "pending") as JourneyStatus,
  }));
}

// JSON string → normalize JourneyStage[] (kanonik aşama sırası korunur; bilinmeyen key atılır;
// eksik aşama default ile tamamlanır; geçersiz status → pending). null/bozuk → defaultJourney().
export function parseJourney(json: string | null | undefined): JourneyStage[] {
  if (!json) return defaultJourney();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return defaultJourney();
  }
  if (!Array.isArray(raw)) return defaultJourney();
  const byKey = new Map<string, JourneyStage>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.key !== "string" || !JOURNEY_STAGE_KEYS.includes(r.key)) continue;
    byKey.set(r.key, {
      key: r.key,
      status: isJourneyStatus(r.status) ? r.status : "pending",
      plannedAt: typeof r.plannedAt === "string" ? r.plannedAt : null,
      doneAt: typeof r.doneAt === "string" ? r.doneAt : null,
      note: typeof r.note === "string" ? r.note : null,
    });
  }
  // Kanonik sıra + eksik aşamaları default ile doldur (her zaman 5 aşama döner).
  return JOURNEY_STAGES.map(
    (s, i) => byKey.get(s.key) ?? { key: s.key, status: (i === 0 ? "active" : "pending") as JourneyStatus },
  );
}

// Panel listesi için ilerleme özeti: tamamlanan aşama + aktif aşama etiketi.
export function journeyProgress(stages: JourneyStage[]): { done: number; total: number; current: string } {
  const done = stages.filter((s) => s.status === "done").length;
  const active = stages.find((s) => s.status === "active");
  const currentKey = active?.key ?? (done === stages.length ? "discharge" : stages[0]?.key);
  const current = JOURNEY_STAGES.find((s) => s.key === currentKey)?.label ?? "—";
  return { done, total: stages.length, current };
}

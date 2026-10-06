// İçerik takvimi — istemci ortak parçaları (v6.332, 2026-10-06): tek uç çağrısı, yanıt tipleri, saat biçimi, stil sabitleri.
// SlotEditor ve PublishPanel paylaşır (SlotEditor'dan taşındı; davranış DEĞİŞMEDİ). İstemci YALNIZ saf modülleri/tipleri içe aktarır
// (payload.ts → Node crypto zinciri tarayıcı paketine giremez). Yalnız --c-* token'ları (/admin ağacı Doctorium kromu).
import type { GateReport } from "@/lib/social-calendar/gates";
import type { RejectCode } from "@/lib/social-calendar/karar";
import type { PlanItemView } from "@/lib/social-calendar/plan";
import type { RenderedSlide } from "@/lib/social-calendar/render-client";

export interface PickStats {
  total: number;
  eligible: number;
  rejected: Partial<Record<RejectCode, number>>;
}

export interface ApiResult {
  ok: boolean;
  status: number;
  error?: string;
  item?: PlanItemView;
  report?: GateReport;
  stats?: PickStats;
  slides?: RenderedSlide[];
}

export type Flash = { kind: "ok" | "err"; text: string } | null;

export const INPUT =
  "w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-60";
export const BTN = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_PRIMARY = `${BTN} bg-[var(--c-accent)] text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]`;
export const BTN_SECOND = `${BTN} border border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]`;
export const BTN_DANGER = `${BTN} border border-[var(--c-danger)]/50 text-[var(--c-danger)] hover:bg-[var(--c-danger)]/10`;

export async function api(body: object): Promise<ApiResult> {
  try {
    const res = await fetch("/api/admin/icerik-takvimi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Omit<ApiResult, "ok" | "status">;
    return { ok: res.ok, status: res.status, ...data };
  } catch {
    return { ok: false, status: 0, error: "Sunucuya ulaşılamadı — bağlantınızı kontrol edin." };
  }
}

// Sunucu/istemci aynı biçimi üretsin (hidrasyon farkı olmasın): Türkiye saati, sabit seçenekler.
export const fmt = (iso: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));

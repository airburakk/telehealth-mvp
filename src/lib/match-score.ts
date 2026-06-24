// CRM eşleştirme kalite indikatörleri — doktor seçimini branş/müsaitlik dışında performans metadata'sıyla
// ağırlıklandırır. Kullanım: Nöbetçi seçimi (clinical-duty), SO uzman oto-atama (second-opinion-service),
// İcapçı randevu fan-out sırası. Pro Bono eşleştirmesi KAPSAM DIŞI (adalet için FIFO kalır — kullanıcı kararı).
//
// 9 metrik (hepsi METADATA — klinik içerik DEĞİL → E2EE şifreleme modeliyle uyumlu, eşleştirmede serbest kullanılır):
//   rating · successRate · pro bono sayısı · icap dönüş oranı   (v2.85 çekirdek)
//   + tamamlanan vaka hacmi · yanıt süresi (duyarlılık) · iptal oranı (güvenilirlik) · yorum hacmi · güncellik   (v2.86 ek)
// "Ölçekle değer artar": doktor havuzu + geçmiş veri azken etki küçük; büyüdükçe duyarlı/güvenilir/deneyimli
// hekimler öne çıkar. Veri yoksa her metrik NÖTR 0.5 döner → yeni hekim ne cezalı ne avantajlı.
// Tüm "kalite" girdileri mevcut tablolardan türetilir; yalnız yanıt süresi Doctor.respCount/respTotalSec sayacını kullanır.
import { db } from "./db";

// Görüşme tamamlandıktan sonraki pro bono durumları (sosyal katkı sayımı) — pro-bono.ts POST_CONSULT ile hizalı.
const PRO_BONO_DONE = ["CONSULT_DONE", "TREATMENT_NEEDED", "ETHICS_REVIEW", "ETHICS_REJECTED", "ETHICS_APPROVED", "COMPLETED"];

export interface DoctorMetrics {
  rating: number; // 0-5 — hasta memnuniyeti (Doctor.rating)
  successRate: number; // 0-100 — başarı oranı (Doctor.successRate)
  proBonoCount: number; // tamamlanan pro bono görüşme sayısı — sosyal katkı
  icapNotified: number; // İcapçı olarak alınan talep bildirimi
  icapOffered: number; // bu taleplere verilen teklif → dönüş oranı = offered/notified
  // ── v2.86 ek metrikler ──
  completedCases: number; // tamamlanan vaka hacmi (Case.status=DONE) — deneyim/hacim
  reviewCount: number; // doğrulanmış yorum sayısı (Review) — rating güven aralığı
  respCount: number; // yanıtlanan İcapçı talebi sayısı (Doctor.respCount)
  respTotalSec: number; // toplam yanıt süresi sn (Doctor.respTotalSec) → ort = total/count
  apptCancelled: number; // atanmış randevudan iptal olan (ConsultAppointment CANCELLED)
  apptTotal: number; // atanmış toplam randevu (iptal oranı paydası)
  lastActiveSec: number | null; // son aktiviteden (görüşme) bu yana geçen sn; null = hiç veri yok
}

// Ağırlıklar (toplam 1.0) — ölçekle ayarlanabilir TEK kaynak. Memnuniyet (rating) en yüksek ağırlık.
export const MATCH_WEIGHTS = {
  rating: 0.22,
  successRate: 0.12,
  proBono: 0.1,
  icapReturn: 0.1,
  responsiveness: 0.12, // yanıt süresi
  reliability: 0.1, // 1 − iptal oranı
  volume: 0.1, // tamamlanan vaka hacmi
  reviewVolume: 0.07, // yorum hacmi
  recency: 0.07, // güncellik
} as const;

// SO yük dengeleme cezası: en kaliteli hoca tüm dosyaları kapmasın → her aktif dosya skoru bu kadar düşürür.
export const LOAD_PENALTY = 0.08;

// Doygunluk eşikleri (log eğrisi: ilk birkaç birim büyük fark, sonra plato).
const PRO_BONO_SATURATION = 10; // ~10 pro bono görüşme ≈ tam puan
const VOLUME_SATURATION = 20; // ~20 tamamlanan vaka ≈ tam puan
const REVIEW_SATURATION = 30; // ~30 yorum ≈ tam güven
// Yanıt süresi referansı: bu sürede yanıt = 0.5 puan; daha hızlı → 1'e, daha yavaş → 0'a.
const RESP_TARGET_SEC = 1800; // 30 dk
// Güncellik yarı-ömrü: son aktiviteden bu kadar gün sonra tazelik yarıya iner.
const RECENCY_HALF_LIFE_DAYS = 45;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const logSat = (n: number, sat: number) => clamp01(Math.log1p(Math.max(0, n)) / Math.log1p(sat));

// İcap dönüş oranı (0-1). Veri yoksa (hiç talep gelmemiş) NÖTR 0.5 → yeni/icapsız hekim ne cezalı ne avantajlı.
export function icapReturnRate(m: { icapNotified: number; icapOffered: number }): number {
  if (m.icapNotified <= 0) return 0.5;
  return clamp01(m.icapOffered / m.icapNotified);
}

// Duyarlılık (0-1): ortalama yanıt süresi düşükse yüksek. 1/(1+avg/HEDEF) → avg=0→1, avg=HEDEF→0.5. Veri yoksa nötr.
export function responsivenessScore(m: { respCount: number; respTotalSec: number }): number {
  if (m.respCount <= 0) return 0.5;
  const avg = m.respTotalSec / m.respCount;
  return clamp01(1 / (1 + avg / RESP_TARGET_SEC));
}

// Güvenilirlik (0-1): 1 − iptal oranı. Atanmış randevu yoksa NÖTR 0.5.
export function reliabilityScore(m: { apptCancelled: number; apptTotal: number }): number {
  if (m.apptTotal <= 0) return 0.5;
  return clamp01(1 - m.apptCancelled / m.apptTotal);
}

// Güncellik (0-1): son aktiviteden bu yana üstel azalma (yarı-ömür). Hiç aktivite yoksa NÖTR 0.5.
export function recencyScore(lastActiveSec: number | null): number {
  if (lastActiveSec == null) return 0.5;
  const days = lastActiveSec / 86_400;
  return clamp01(Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS));
}

// Ağırlıklı kalite skoru (0-1) — VERİ-OLGUNLUK FARKINDA. Oran/zaman metrikleri (icap dönüş · yanıt süresi ·
// iptal oranı · güncellik) verisi YOKKEN skoru nötr 0.5 ile dilute etmesin diye ATLANIR; ağırlıkları kalan
// geçerli metriklere yeniden normalize edilir → metrikler veri geldikçe devreye girer ("ölçekle değer artar")
// ve az-veri hekim ortaya çekilmez. rating/successRate her zaman geçerli; sayım metrikleri (pro bono · vaka
// hacmi · yorum) 0 = gerçek düşük sinyal (atlanmaz, düşük puan alır). (Saf — test edilebilir.)
export function doctorMatchScore(m: DoctorMetrics): number {
  // Her zaman geçerli (rating/success) + sayım metrikleri (0 = düşük, atlanmaz).
  const parts: Array<[number, number]> = [
    [clamp01(m.rating / 5), MATCH_WEIGHTS.rating],
    [clamp01(m.successRate / 100), MATCH_WEIGHTS.successRate],
    [logSat(m.proBonoCount, PRO_BONO_SATURATION), MATCH_WEIGHTS.proBono],
    [logSat(m.completedCases, VOLUME_SATURATION), MATCH_WEIGHTS.volume],
    [logSat(m.reviewCount, REVIEW_SATURATION), MATCH_WEIGHTS.reviewVolume],
  ];
  // Oran/zaman metrikleri: yalnız verisi/paydası varsa ekle (yoksa atla → ağırlık kalanlara yeniden dağılır).
  if (m.icapNotified > 0) parts.push([icapReturnRate(m), MATCH_WEIGHTS.icapReturn]);
  if (m.respCount > 0) parts.push([responsivenessScore(m), MATCH_WEIGHTS.responsiveness]);
  if (m.apptTotal > 0) parts.push([reliabilityScore(m), MATCH_WEIGHTS.reliability]);
  if (m.lastActiveSec != null) parts.push([recencyScore(m.lastActiveSec), MATCH_WEIGHTS.recency]);
  const totalW = parts.reduce((s, [, w]) => s + w, 0);
  return totalW > 0 ? parts.reduce((s, [v, w]) => s + v * (w / totalW), 0) : 0;
}

// rankDoctorsByQuality'nin ihtiyaç duyduğu minimum doktor alanları (full Doctor row bunları içerir).
type DoctorRow = {
  id: string;
  rating: number;
  successRate: number;
  icapNotified: number;
  icapOffered: number;
  respCount: number;
  respTotalSec: number;
};

// ── Toplu (N+1'siz) veri çekiciler: yalnız aday doktorlar için, tek sorgu ──

// Tamamlanan pro bono görüşme sayısı.
async function proBonoCounts(ids: string[]): Promise<Map<string, number>> {
  const rows = await db.case.groupBy({
    by: ["doctorId"],
    where: { proBono: true, doctorId: { in: ids }, proBonoStatus: { in: PRO_BONO_DONE } },
    _count: true,
  });
  const m = new Map<string, number>();
  for (const r of rows) if (r.doctorId) m.set(r.doctorId, r._count);
  return m;
}

// Tamamlanan vaka hacmi (Case.status=DONE).
async function completedCaseCounts(ids: string[]): Promise<Map<string, number>> {
  const rows = await db.case.groupBy({
    by: ["doctorId"],
    where: { status: "DONE", doctorId: { in: ids } },
    _count: true,
  });
  const m = new Map<string, number>();
  for (const r of rows) if (r.doctorId) m.set(r.doctorId, r._count);
  return m;
}

// Doğrulanmış yorum sayısı (Review).
async function reviewCounts(ids: string[]): Promise<Map<string, number>> {
  const rows = await db.review.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids } }, _count: true });
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.doctorId, r._count);
  return m;
}

// Son aktivite anı (en son görüşme başlangıcı) → güncellik için.
async function lastActiveMap(ids: string[]): Promise<Map<string, Date>> {
  const rows = await db.consultation.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids } }, _max: { startedAt: true } });
  const m = new Map<string, Date>();
  for (const r of rows) if (r._max.startedAt) m.set(r.doctorId, r._max.startedAt);
  return m;
}

// İptal istatistiği: atanmış toplam randevu + iptal olan. ConsultAppointment (İcapçı) + SecondOpinionAppointment
// (İkinci Görüş) birleşik — doctorId dolu olanlar. İptal oranı = cancelled/total (iki randevu kanalı toplamı).
async function cancelStats(ids: string[]): Promise<Map<string, { total: number; cancelled: number }>> {
  const [caTotal, caCancel, soTotal, soCancel] = await Promise.all([
    db.consultAppointment.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids } }, _count: true }),
    db.consultAppointment.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids }, status: "CANCELLED" }, _count: true }),
    db.secondOpinionAppointment.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids } }, _count: true }),
    db.secondOpinionAppointment.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids }, status: "CANCELLED" }, _count: true }),
  ]);
  const m = new Map<string, { total: number; cancelled: number }>();
  const bump = (rows: { doctorId: string | null; _count: number }[], key: "total" | "cancelled") => {
    for (const r of rows) if (r.doctorId) {
      const e = m.get(r.doctorId) ?? { total: 0, cancelled: 0 };
      e[key] += r._count;
      m.set(r.doctorId, e);
    }
  };
  bump(caTotal, "total"); bump(soTotal, "total");
  bump(caCancel, "cancelled"); bump(soCancel, "cancelled");
  return m;
}

/**
 * Doktor adaylarını kalite skoruna göre sırala (yüksek önce). `loads` verilirse (SO yük dengeleme)
 * birleşik skor = kalite − LOAD_PENALTY·load → kaliteli ama az yüklü hoca öne gelir, bir hoca boğulmaz.
 * Tüm kalite girdileri toplu (paralel) çekilir; salt-okuma (yan etkisiz). 0/1 elemanlı liste güvenli.
 */
export async function rankDoctorsByQuality<T extends DoctorRow>(
  doctors: T[],
  opts?: { loads?: Map<string, number> },
): Promise<T[]> {
  if (doctors.length <= 1) return [...doctors];
  const ids = doctors.map((d) => d.id);
  const [pb, cc, rc, la, cs] = await Promise.all([
    proBonoCounts(ids),
    completedCaseCounts(ids),
    reviewCounts(ids),
    lastActiveMap(ids),
    cancelStats(ids),
  ]);
  const now = Date.now();
  const scored = doctors.map((d) => {
    const last = la.get(d.id);
    const cancel = cs.get(d.id);
    const base = doctorMatchScore({
      rating: d.rating,
      successRate: d.successRate,
      proBonoCount: pb.get(d.id) ?? 0,
      icapNotified: d.icapNotified,
      icapOffered: d.icapOffered,
      completedCases: cc.get(d.id) ?? 0,
      reviewCount: rc.get(d.id) ?? 0,
      respCount: d.respCount,
      respTotalSec: d.respTotalSec,
      apptCancelled: cancel?.cancelled ?? 0,
      apptTotal: cancel?.total ?? 0,
      lastActiveSec: last ? (now - last.getTime()) / 1000 : null,
    });
    const load = opts?.loads?.get(d.id) ?? 0;
    return { d, score: base - LOAD_PENALTY * load };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.d);
}

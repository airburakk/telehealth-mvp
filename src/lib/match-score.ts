// CRM eşleştirme kalite indikatörleri — doktor seçimini branş/müsaitlik dışında performans metadata'sıyla
// ağırlıklandırır. Kullanım: Nöbetçi seçimi (clinical-duty), SO uzman oto-atama (second-opinion-service),
// İcapçı randevu fan-out sırası. Pro Bono eşleştirmesi KAPSAM DIŞI (adalet için FIFO kalır — kullanıcı kararı).
//
// 9 metrik (hepsi METADATA — klinik içerik DEĞİL → E2EE şifreleme modeliyle uyumlu, eşleştirmede serbest kullanılır):
//   rating · successRate · pro bono sayısı · icap dönüş oranı   (v2.85 çekirdek)
//   + tamamlanan vaka hacmi · yanıt süresi (duyarlılık) · iptal oranı (güvenilirlik) · yorum hacmi · güncellik   (v2.86 ek)
// "Ölçekle değer artar": doktor havuzu + geçmiş veri azken etki küçük; büyüdükçe duyarlı/güvenilir/deneyimli
// doktorlar öne çıkar. Veri yoksa metrik ya INACTIVE olur (skordan atlanır, ağırlık yeniden normalize) ya da
// NÖTR 0.5 döner → yeni doktor ne cezalı ne avantajlı. rating/successRate null = "veri yok" (0 DEĞİL).
// Tüm "kalite" girdileri mevcut tablolardan türetilir; yalnız yanıt süresi Doctor.respCount/respTotalSec sayacını kullanır.
import { db } from "./db";

// Görüşme tamamlandıktan sonraki pro bono durumları (sosyal katkı sayımı) — pro-bono.ts POST_CONSULT ile hizalı.
const PRO_BONO_DONE = ["CONSULT_DONE", "TREATMENT_NEEDED", "ETHICS_REVIEW", "ETHICS_REJECTED", "ETHICS_APPROVED", "COMPLETED"];

export interface DoctorMetrics {
  rating: number | null; // 0-5 — hasta memnuniyeti (Doctor.rating); null = veri yok → metrik INACTIVE
  successRate: number | null; // 0-100 — başarı oranı (Doctor.successRate); null = veri yok → metrik INACTIVE
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

// İcap dönüş oranı (0-1). Veri yoksa (hiç talep gelmemiş) NÖTR 0.5 → yeni/icapsız doktor ne cezalı ne avantajlı.
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

// Bir metriğin skora katkısı: normalize değer (0-1) + ağırlık + aktif mi (verisi var mı → skora girer).
// Skor hesabı + doktor profili "kalite kartı" TEK kaynaktan (metricBreakdown) beslenir.
export type MetricKey =
  | "rating" | "successRate" | "proBono" | "volume" | "reviewVolume"
  | "icapReturn" | "responsiveness" | "reliability" | "recency";
export interface MetricBreakdown {
  key: MetricKey;
  value01: number; // 0-1 normalize skor
  weight: number; // MATCH_WEIGHTS payı
  active: boolean; // skora dahil mi (oran/zaman metrikleri veri yoksa false → atlanır)
}

// Tüm metriklerin normalize değeri + aktifliği. Sayım metrikleri (pro bono · vaka · yorum) HER ZAMAN aktif
// (0 = gerçek düşük sinyal); rating/successRate null olabilir (yeni self-signup doktor — veri yok ≠ 0 puan)
// ve oran/zaman metrikleri (icap · yanıt · iptal · güncellik) gibi yalnız verisi varsa aktif
// (yoksa skoru dilute etmemek için atlanır → ağırlık kalan aktif kümeye yeniden normalize edilir).
export function metricBreakdown(m: DoctorMetrics): MetricBreakdown[] {
  return [
    { key: "rating", value01: clamp01((m.rating ?? 0) / 5), weight: MATCH_WEIGHTS.rating, active: m.rating != null },
    { key: "successRate", value01: clamp01((m.successRate ?? 0) / 100), weight: MATCH_WEIGHTS.successRate, active: m.successRate != null },
    { key: "proBono", value01: logSat(m.proBonoCount, PRO_BONO_SATURATION), weight: MATCH_WEIGHTS.proBono, active: true },
    { key: "volume", value01: logSat(m.completedCases, VOLUME_SATURATION), weight: MATCH_WEIGHTS.volume, active: true },
    { key: "reviewVolume", value01: logSat(m.reviewCount, REVIEW_SATURATION), weight: MATCH_WEIGHTS.reviewVolume, active: true },
    { key: "icapReturn", value01: icapReturnRate(m), weight: MATCH_WEIGHTS.icapReturn, active: m.icapNotified > 0 },
    { key: "responsiveness", value01: responsivenessScore(m), weight: MATCH_WEIGHTS.responsiveness, active: m.respCount > 0 },
    { key: "reliability", value01: reliabilityScore(m), weight: MATCH_WEIGHTS.reliability, active: m.apptTotal > 0 },
    { key: "recency", value01: recencyScore(m.lastActiveSec), weight: MATCH_WEIGHTS.recency, active: m.lastActiveSec != null },
  ];
}

// Ağırlıklı kalite skoru (0-1) — VERİ-OLGUNLUK FARKINDA: yalnız AKTİF metrikler (verisi olanlar) skora girer,
// ağırlıkları kalan aktif kümeye yeniden normalize edilir → oran/zaman metrikleri veri yokken skoru nötr 0.5
// ile dilute etmez ("ölçekle değer artar"). (Saf — test edilebilir.)
export function doctorMatchScore(m: DoctorMetrics): number {
  const active = metricBreakdown(m).filter((p) => p.active);
  const totalW = active.reduce((s, p) => s + p.weight, 0);
  return totalW > 0 ? active.reduce((s, p) => s + p.value01 * (p.weight / totalW), 0) : 0;
}

// ── Doktor–hasta UYUM (fit) — hasta-spesifik eşleştirme sinyali (KALİTEDEN AYRI eksen) ──
// Kalite (yukarısı) = doktor ne kadar iyi (mutlak, hasta-agnostik). Uyum = bu doktor BU vakaya ne kadar
// uygun (göreceli). SOFT BOOST: uyumlu doktor sıralamada öne çıkar, uyumsuz ELENMEZ (erişim korunur).
// Şema değişmez — iki sinyal mevcut alanlardan türetilir:
//   • pazar/ülke   : Doctor.markets ⊇ Case.country  (doktor hastanın pazarına hizmet veriyor mu)
//   • aciliyet–deneyim: yüksek Case.urgency → Doctor.experienceYears (acil/karmaşık vaka deneyimli doktora)
// Dil KASITEN dahil değil (simultane tercüme kapsar — kullanıcı kararı, [[match-score]] kalite notuyla aynı).
export interface CaseContext {
  country?: string | null; // hasta ülkesi (Case.country / SecondOpinionCase.country) — pazar uyumu; yoksa nötr
  urgency?: number | null; // 1-5 (Case.urgency); yüksekse deneyim uyumu devreye girer. SO'da yok → null → nötr
}

// Uyum boost katsayısı: AKTİF metrik kalite skoruna (0-1) eklenen pay. Kaliteyi EZMEZ, tamamlar (ölçekle ayarlanır).
export const FIT_WEIGHT = 0.18;
// Uyum iç dengesi: pazar ÇEKİRDEK, aciliyet–deneyim İKİNCİL (toplam 1.0).
const FIT_MARKET = 0.7;
const FIT_URGENCY_EXP = 0.3;
const EXP_SATURATION = 20; // ~20 yıl deneyim ≈ tam puan (log doygunluk)
const HIGH_URGENCY = 4; // urgency ≥ bu → aciliyet–deneyim uyumu aktifleşir (altı: deneyim ayırt edici değil)

// Pazar uyumu (0-1): doktor pazarları hastanın ülkesini kapsıyor mu. markets BOŞ = "tüm pazarlar" → 1.
// Hasta ülkesi bilinmiyorsa (null) → 1 (ayrıştıracak veri yok). Kapsamıyorsa 0 (soft → yalnız geri sıralanır).
export function marketFit(country: string | null | undefined, markets: string | null | undefined): number {
  const c = country?.trim();
  if (!c) return 1;
  const set = (markets ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (set.length === 0) return 1;
  return set.includes(c) ? 1 : 0;
}

// Aciliyet–deneyim uyumu (0-1): yalnız YÜKSEK aciliyette (urgency≥HIGH_URGENCY) deneyim öne çıkar.
// Düşük aciliyet / urgency yok (SO) → NÖTR 0.5 (bu vakada deneyim ayırt edici değil → kaliteyi bozma).
// experienceYears null (yeni self-signup doktor — veri yok) → NÖTR 0.5 (ne cezalı ne avantajlı).
export function urgencyExperienceFit(urgency: number | null | undefined, experienceYears: number | null | undefined): number {
  if ((urgency ?? 0) < HIGH_URGENCY) return 0.5;
  if (experienceYears == null) return 0.5;
  return logSat(experienceYears, EXP_SATURATION);
}

// Birleşik uyum (0-1): pazar (çekirdek) + aciliyet–deneyim (ikincil). Saf — test edilebilir.
export function fitScore(ctx: CaseContext, doc: { markets: string | null; experienceYears: number | null }): number {
  return FIT_MARKET * marketFit(ctx.country, doc.markets) + FIT_URGENCY_EXP * urgencyExperienceFit(ctx.urgency, doc.experienceYears);
}

// rankDoctorsByQuality'nin ihtiyaç duyduğu minimum doktor alanları (full Doctor row bunları içerir).
type DoctorRow = {
  id: string;
  rating: number | null; // null = veri yok (yeni self-signup) → metrik inactive
  successRate: number | null; // null = veri yok → metrik inactive
  icapNotified: number;
  icapOffered: number;
  respCount: number;
  respTotalSec: number;
  markets: string | null; // uyum (pazar) — full Doctor row içerir
  experienceYears: number | null; // uyum (aciliyet–deneyim) — null → nötr; full Doctor row içerir
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
 * Doktor adaylarını skoruna göre sırala (yüksek önce). Birleşik skor =
 *   kalite − LOAD_PENALTY·load + FIT_WEIGHT·uyum
 * `loads` (SO yük dengeleme) → kaliteli ama az yüklü hoca öne gelir, bir hoca boğulmaz.
 * `caseContext` (hasta–doktor uyumu) → hastanın pazarına/aciliyetine uygun doktor SOFT olarak öne çıkar
 * (uyumsuz ELENMEZ, yalnız geri sıralanır → erişim korunur). Bağlam verilmezse uyum boost'u uygulanmaz
 * (eski davranış birebir). Tüm kalite girdileri toplu (paralel) çekilir; salt-okuma. 0/1 elemanlı liste güvenli.
 */
export async function rankDoctorsByQuality<T extends DoctorRow>(
  doctors: T[],
  opts?: { loads?: Map<string, number>; caseContext?: CaseContext },
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
    const fitBoost = opts?.caseContext ? FIT_WEIGHT * fitScore(opts.caseContext, d) : 0;
    return { d, score: base - LOAD_PENALTY * load + fitBoost };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.d);
}

// ── Doktor profili "Eşleştirme Kalite Kartı" — tek doktorun metrik dökümü + genel skor (şeffaflık) ──
export interface DoctorScorecard {
  score: number; // 0-1 genel kalite skoru (Nöbetçi/İcapçı/SO eşleştirme önceliği)
  metrics: Array<MetricBreakdown & { raw: string }>; // her metrik + okunur ham değer
}

// Doktorun kendi profili için kalite kartını üret — rankDoctorsByQuality ile AYNI metrik kaynakları.
export async function getDoctorScorecard(doctorId: string): Promise<DoctorScorecard | null> {
  const d = await db.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, rating: true, successRate: true, icapNotified: true, icapOffered: true, respCount: true, respTotalSec: true },
  });
  if (!d) return null;
  const ids = [doctorId];
  const [pb, cc, rc, la, cs] = await Promise.all([
    proBonoCounts(ids), completedCaseCounts(ids), reviewCounts(ids), lastActiveMap(ids), cancelStats(ids),
  ]);
  const last = la.get(doctorId);
  const cancel = cs.get(doctorId);
  const m: DoctorMetrics = {
    rating: d.rating, successRate: d.successRate, proBonoCount: pb.get(doctorId) ?? 0,
    icapNotified: d.icapNotified, icapOffered: d.icapOffered,
    completedCases: cc.get(doctorId) ?? 0, reviewCount: rc.get(doctorId) ?? 0,
    respCount: d.respCount, respTotalSec: d.respTotalSec,
    apptCancelled: cancel?.cancelled ?? 0, apptTotal: cancel?.total ?? 0,
    lastActiveSec: last ? (Date.now() - last.getTime()) / 1000 : null,
  };
  const raw: Record<MetricKey, string> = {
    rating: m.rating != null ? m.rating.toFixed(1) : "—", // null = veri yok → 0.0 GÖSTERİLMEZ
    successRate: m.successRate != null ? `%${m.successRate}` : "—",
    proBono: `${m.proBonoCount}`,
    volume: `${m.completedCases}`,
    reviewVolume: `${m.reviewCount}`,
    icapReturn: m.icapNotified > 0 ? `${m.icapOffered}/${m.icapNotified}` : "—",
    responsiveness: m.respCount > 0 ? `~${Math.round(m.respTotalSec / m.respCount / 60)} dk` : "—",
    reliability: m.apptTotal > 0 ? `${m.apptCancelled}/${m.apptTotal} iptal` : "—",
    recency: m.lastActiveSec != null ? `${Math.round(m.lastActiveSec / 86_400)} gün önce` : "—",
  };
  return { score: doctorMatchScore(m), metrics: metricBreakdown(m).map((p) => ({ ...p, raw: raw[p.key] })) };
}

// ── Herkese-açık profil (/hekim/[id]) güven rozetleri — EŞİK geçen olumlu metrikler ──
// ⚠️ Ham skor / sıralama / iptal sayısı GÖSTERİLMEZ (içsel CRM metriği + rakip-hassas); yalnız hastaya
// anlamlı, olumlu güven sinyalleri rozet olarak. Eşik altı/verisiz metrik → rozet yok (yanlış-pozitif yok).
export interface DoctorBadge { key: MetricKey; label: string; desc: string }
export async function getDoctorBadges(doctorId: string): Promise<DoctorBadge[]> {
  const sc = await getDoctorScorecard(doctorId);
  if (!sc) return [];
  const v = new Map(sc.metrics.map((p) => [p.key, p]));
  const m = (k: MetricKey) => v.get(k)!;
  const badges: DoctorBadge[] = [];
  if (m("rating").active && m("rating").value01 >= 0.92) badges.push({ key: "rating", label: "Yüksek Memnuniyet", desc: "Hasta memnuniyet puanı yüksek (4.6+/5)" }); // rating null (veri yok) → rozet YOK
  if (m("volume").value01 >= 0.5) badges.push({ key: "volume", label: "Deneyimli", desc: "Platformda çok sayıda tamamlanmış görüşme" });
  if (m("proBono").value01 > 0) badges.push({ key: "proBono", label: "Pro Bono Gönüllüsü", desc: "Ücretsiz gönüllü (pro bono) konsültasyon veriyor" });
  if (m("responsiveness").active && m("responsiveness").value01 >= 0.6) badges.push({ key: "responsiveness", label: "Hızlı Yanıt", desc: "Randevu taleplerine hızlı yanıt veriyor" });
  if (m("reliability").active && m("reliability").value01 >= 0.9) badges.push({ key: "reliability", label: "Güvenilir", desc: "Randevu iptal oranı düşük" });
  if (m("recency").active && m("recency").value01 >= 0.7) badges.push({ key: "recency", label: "Aktif Doktor", desc: "Son dönemde aktif olarak görüşme yapıyor" });
  return badges;
}

// CRM eşleştirme kalite indikatörleri — doktor seçimini branş/müsaitlik dışında performans metadata'sıyla
// ağırlıklandırır. Kullanım: Nöbetçi seçimi (clinical-duty), SO uzman oto-atama (second-opinion-service),
// İcapçı randevu fan-out sırası. Pro Bono eşleştirmesi KAPSAM DIŞI (adalet için FIFO kalır — kullanıcı kararı).
//
// Tüm metrikler METADATA (rating/successRate/pro bono sayısı/icap dönüş oranı) — klinik içerik DEĞİL →
// E2EE şifreleme modeliyle uyumlu (şifrelenmez, eşleştirmede serbest kullanılır; [[hasta-verisi-uctan-uca-sifreleme]]).
// "Ölçekle değer artar": doktor havuzu azken etki küçük; büyüdükçe kaliteli/duyarlı hekimler öne çıkar.
import { db } from "./db";

// Görüşme tamamlandıktan sonraki pro bono durumları (sosyal katkı sayımı) — pro-bono.ts POST_CONSULT ile hizalı.
const PRO_BONO_DONE = ["CONSULT_DONE", "TREATMENT_NEEDED", "ETHICS_REVIEW", "ETHICS_REJECTED", "ETHICS_APPROVED", "COMPLETED"];

export interface DoctorMetrics {
  rating: number; // 0-5 — hasta memnuniyeti (Doctor.rating)
  successRate: number; // 0-100 — başarı oranı (Doctor.successRate)
  proBonoCount: number; // tamamlanan pro bono görüşme sayısı — sosyal katkı
  icapNotified: number; // İcapçı olarak alınan talep bildirimi
  icapOffered: number; // bu taleplere verilen teklif → dönüş oranı = offered/notified
}

// Ağırlıklar (toplam 1.0) — ölçekle ayarlanabilir TEK kaynak. Memnuniyet en yüksek ağırlık.
export const MATCH_WEIGHTS = { rating: 0.4, successRate: 0.2, proBono: 0.2, icapReturn: 0.2 } as const;

// SO yük dengeleme cezası: en kaliteli hoca tüm dosyaları kapmasın → her aktif dosya skoru bu kadar düşürür.
export const LOAD_PENALTY = 0.08;

// Pro bono sayısı doygunluğu: birkaç görüşme büyük fark, sonra plato (log eğrisi). ~10 görüşme ≈ tam puan.
const PRO_BONO_SATURATION = 10;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// İcap dönüş oranı (0-1). Veri yoksa (hiç talep gelmemiş) NÖTR 0.5 → yeni/icapsız hekim ne cezalı ne avantajlı.
export function icapReturnRate(m: { icapNotified: number; icapOffered: number }): number {
  if (m.icapNotified <= 0) return 0.5;
  return clamp01(m.icapOffered / m.icapNotified);
}

// 0-1 normalize edilmiş ağırlıklı kalite skoru. Yüksek = eşleştirmede öncelikli. (Saf — test edilebilir.)
export function doctorMatchScore(m: DoctorMetrics): number {
  const nRating = clamp01(m.rating / 5);
  const nSuccess = clamp01(m.successRate / 100);
  const nProBono = clamp01(Math.log1p(Math.max(0, m.proBonoCount)) / Math.log1p(PRO_BONO_SATURATION));
  const nIcap = icapReturnRate(m);
  return (
    MATCH_WEIGHTS.rating * nRating +
    MATCH_WEIGHTS.successRate * nSuccess +
    MATCH_WEIGHTS.proBono * nProBono +
    MATCH_WEIGHTS.icapReturn * nIcap
  );
}

// rankDoctorsByQuality'nin ihtiyaç duyduğu minimum doktor alanları (full Doctor row bunları içerir).
type DoctorRow = { id: string; rating: number; successRate: number; icapNotified: number; icapOffered: number };

// Birden çok doktorun tamamlanan pro bono sayısını TEK groupBy ile getir (N+1 sorgu yok).
async function proBonoCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.case.groupBy({
    by: ["doctorId"],
    where: { proBono: true, doctorId: { in: ids }, proBonoStatus: { in: PRO_BONO_DONE } },
    _count: true,
  });
  const m = new Map<string, number>();
  for (const r of rows) if (r.doctorId) m.set(r.doctorId, r._count);
  return m;
}

/**
 * Doktor adaylarını kalite skoruna göre sırala (yüksek önce). `loads` verilirse (SO yük dengeleme)
 * birleşik skor = kalite − LOAD_PENALTY·load → kaliteli ama az yüklü hoca öne gelir, bir hoca boğulmaz.
 * Pro bono sayıları toplu çekilir; salt-okuma (yan etkisiz). 0/1 elemanlı liste güvenli (olduğu gibi döner).
 */
export async function rankDoctorsByQuality<T extends DoctorRow>(
  doctors: T[],
  opts?: { loads?: Map<string, number> },
): Promise<T[]> {
  if (doctors.length <= 1) return [...doctors];
  const pb = await proBonoCounts(doctors.map((d) => d.id));
  const scored = doctors.map((d) => {
    const base = doctorMatchScore({
      rating: d.rating,
      successRate: d.successRate,
      proBonoCount: pb.get(d.id) ?? 0,
      icapNotified: d.icapNotified,
      icapOffered: d.icapOffered,
    });
    const load = opts?.loads?.get(d.id) ?? 0;
    return { d, score: base - LOAD_PENALTY * load };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.d);
}

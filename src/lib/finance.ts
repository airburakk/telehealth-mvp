// Finans — hakediş SÖZLÜĞÜ (kontrol raporu 2026-09-17 D05, v6.281).
//
// Eskiden doktor/finans tüm ENDED görüşmeleri aynı sabit ücretle topluyordu: Ücretsiz Sağlık Hizmeti görüşmeleri
// "Uzaktan Sağlık" bölümünde 150 USD brüt / 120 USD net görünüyor, sağlık turizmi görüşmeleri (ödemesiz kulvar,
// v6.34) de aynı listeye giriyordu. Hakediş olayı artık KULVAR + ÜCRET SÖZLEŞMESİYLE hesaplanır:
//   · telehealth → demo görüşme ücreti − platform komisyonu (simülasyon; gerçek ödeme entegrasyonu yok)
//   · free       → 0 USD, "ücretsiz katkı" olarak AYRI sayılır (gönüllü hizmet; hakediş değildir)
//   · tourism    → doktor payı tanımlı DEĞİL (Booking split'i kurum kalemlerine bölünür) → hakedişe girmez,
//                  görüşme sayısı Sağlık Turizmi bölümünde mutabakat notuyla görünür
// Kulvar önceliği hasta tarafı (vakalarim) ve liste-DTO'su (case-access caseLaneOf) ile AYNI: turizm > ücretsiz > tele.
//
// Dökümde HASTA ADI YOK (K02/K03 kapsamı): takip erişimi kapanmış ve silme-kilitli vakaların adı finans ekranında
// tutulmaz; muhasebe referansı için kimliksiz işlem numarası (txRef) yeterlidir.
import { caseLaneOf, type CaseLane } from "@/lib/case-access";

/** Demo ücret modeli — profil v1'den miras; SİMÜLASYON (ekranda etiketlenir). */
export const CONSULT_FEE = 150;
export const COMMISSION = 0.2;

export type EarningLane = CaseLane;

export type EndedConsultation = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  case: { freeCare: boolean | null; tourismPlan: string | null };
};

/** Görüşmenin hakediş kulvarı — vaka kulvarıyla aynı türetim. */
export function consultationLane(c: Pick<EndedConsultation, "case">): EarningLane {
  return caseLaneOf(c.case);
}

/** Uzaktan Sağlık görüşmesinin doktor net payı (komisyon sonrası). Yalnız telehealth kulvarı için anlamlıdır. */
export function teleNet(fee: number = CONSULT_FEE, commission: number = COMMISSION): number {
  return Math.round(fee * (1 - commission) * 100) / 100;
}

/** Görüşmenin hakediş tutarı — kulvar sözleşmesi: tele = net · free = 0 · tourism = 0 (pay mutabakatta). */
export function consultationEarning(c: Pick<EndedConsultation, "case">): number {
  return consultationLane(c) === "telehealth" ? teleNet() : 0;
}

/** Kimliksiz işlem numarası — dökümde hasta adı yerine (K02/K03). */
export function txRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

export type LaneSummary = { tele: number; free: number; tourism: number; teleTotal: number };

/** Kulvar özeti: sayılar + yalnız tele toplamı (free/tourism hakedişe girmez). */
export function laneSummary(rows: Pick<EndedConsultation, "case">[]): LaneSummary {
  const s: LaneSummary = { tele: 0, free: 0, tourism: 0, teleTotal: 0 };
  for (const r of rows) {
    const lane = consultationLane(r);
    if (lane === "telehealth") { s.tele += 1; s.teleTotal += teleNet(); }
    else if (lane === "free") s.free += 1;
    else s.tourism += 1;
  }
  s.teleTotal = Math.round(s.teleTotal * 100) / 100;
  return s;
}

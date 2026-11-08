/** Editorial research candidates only. Not approval records or executable clinical rules. */
export interface FamilyMedicineSourceCandidate {
  workflowId: string;
  url: string;
  version: string;
  locator: string;
  observedOn: string;
  scope: string;
  remainingReview: string;
}
const asmPdf = "https://dosyaism.saglik.gov.tr/Eklenti/289859/0/asmizlemevedegerlendirmesoruformu2026pdf.pdf";
const asmCandidate = (workflowId: string, locator: string, scope: string): FamilyMedicineSourceCandidate => ({
  workflowId, url: asmPdf, version: "DENİZ 01.09.2026; Bingöl ASM formu", locator, observedOn: "2026-11-07", scope,
  remainingReview: "Madde konumu kaynak metninde görüldü. Dayanak mevzuatın güncel metni, yerel kapsam ve sonraki değişiklikler ayrıca incelenmeli; hekim/hukuk onayı yok.",
});
const reportCandidate = (workflowId: string, locator: string, scope: string): FamilyMedicineSourceCandidate => ({
  workflowId, url: "https://dosyamerkez.saglik.gov.tr/Eklenti/54927/0/saglik-raporlari-yonetmeligi.pdf", version: "Sağlık Raporları Yönetmeliği; 19.05.2026 / 33258 RG", locator, observedOn: "2026-11-07", scope,
  remainingReview: "Araştırmadaki görsel PDF incelemesinden aktarılan adaydır; kapsam, istisnalar ve sonraki değişiklikler bağımsız yeniden incelenmeli. Hekim/hukuk onayı yok.",
});
export const FAMILY_MEDICINE_SOURCE_CANDIDATES: readonly FamilyMedicineSourceCandidate[] = [
  reportCandidate("driver", "Sayfa 17; md.35; ortak başvuru/kimlik: s.4 md.6–7", "Sürücü raporları için ilgili bölüm; yetki ve özel düzenlemeler ayrıca incelenmeli."),
  reportCandidate("employment", "Sayfa 32; md.64(6)", "İşyeri çalışan sayısı ve tehlike sınıfının birlikte değerlendirildiği dar kapsam; tüm işe giriş raporlarına genellenemez."),
  reportCandidate("marriage", "Sayfa 13–14; md.27", "Evlilik öncesi rapor bölümüne yönlendirme; klinik işlem veya tetkik listesi değildir."),
  reportCandidate("sick-leave", "Sayfa 7; md.12", "İstirahat raporu süre ve istisnaları için kaynak konumu; tek bir süre kuralı çıkarılmadı."),
  asmCandidate("cold-chain", "Sayfa 4; 6.8–6.9", "Isı izlem kaydı ve soğuk zincir yönetimi başlıkları; genelge dayanağı ayrıca kontrol edilecek."),
  asmCandidate("expiry", "Sayfa 4; 5.24", "Saklama koşulları, miat ve stok listesi başlıkları."),
  asmCandidate("maintenance", "Sayfa 4; 5.26", "Cihaz bakım, onarım ve kalibrasyon başlıkları; dayanak yönetmelik 10–12. maddelerine yönlendiriyor."),
  asmCandidate("hygiene", "Sayfa 2; 4.2 ve 4.12", "Genel temizlik ve tuvalet temizlik takibi başlıkları."),
  asmCandidate("training", "Sayfa 2; 4.15–4.16", "Acil durum ekipleri ve tıbbi atık eğitimi başlıkları; tüm personel eğitimlerinin eksiksiz listesi değil."),
];

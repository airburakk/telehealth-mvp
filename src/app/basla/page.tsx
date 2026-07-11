import { redirect } from "next/navigation";

// "Nasıl İlerlemek İstersiniz?" 4'lü seçim ekranı KALDIRILDI (2026-07-12, kullanıcı kararı):
// giriş hunisi doğrudan Branş Doktoru akışına (/triyaj) iner. Diğer kulvarlar kendi
// sayfalarından başvurulur (İkinci Görüş /second-opinion · Ücretsiz Sağlık /ucretsiz-saglik ·
// Sağlık Turizmi /saglik-turizmi); User.patientJourney artık başvurulan akışta damgalanır
// (lib/patient-journey). Bu rota eski linkler/bildirimler için kalıcı köprüdür.
export default function BaslaRedirect() {
  redirect("/triyaj");
}

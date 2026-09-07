import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * ESKİ Kariyer EDU ayrıntı sayfası → YÖNLENDİRME (2026-09-06, kullanıcı kararı "Kariyer'i Hukuk'taki gibi böl").
 * Staj · değişim · burs fırsatları artık öğrencinin Kariyer sahnesinin VARSAYILAN sekmesidir (Fırsatlar, ?m=kariyer; tür çipleri
 * ?tur=staj|degisim|burs) — ayrı bir ayrıntı sayfası kalmadı. Bu rota, daha önce gönderilen bildirim/e-posta bağlantıları ve yer
 * imleri kırılmasın diye duruyor; `#edu-<id>` parçasını tarayıcı yönlendirmede korur (Location parçasızdır), satır vurgusu çalışır.
 * Yeni bağlantılar doğrudan Kariyer'e üretilir (lib/edu-reminder EDU_KARIYER_PATH · lib/calendar).
 */
export default function KariyerEduRedirect() {
  redirect("/doktor/doctorium?m=kariyer");
}

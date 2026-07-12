// Sağlık Turizmi — AURA-dışı sorumluluk reddi (2026-07-12, kullanıcı kararı).
// Hasta "Talep Oluştur"a bastıktan hemen sonra iletişim tercihi üzerinden gönderilir
// (canlı kanal: uygulama-içi bildirim + push; SMS/e-posta dormant → aktifleşince eklenir).
// ⚠️ TASLAK — hukuk müşaviri nihai metni onaylamalı (vault todo #önemli). Tek doğruluk kaynağı:
// hem sunucu bildirimi (notifyUser body) hem hasta-yüzü onay ekranı bu metni kullanır.
export const TOURISM_DISCLAIMER_TITLE = "Önemli: Sağlık turizmi sorumluluk bildirimi";

export const TOURISM_DISCLAIMER_BODY =
  "Sağlık turizmi planlamanızı, sağlık profesyonelleriyle AURA platformu DIŞINDA bir yolla organize etmeniz " +
  "durumunda AURA hiçbir şekilde sorumluluk kabul etmez. Süreç içinde bir sorunla karşılaşmanız halinde " +
  "şirketimiz hiçbir şekilde müdahale etmez, Etik Kurul başvurusu aktive olmaz ve sigorta kapsamınız dışında " +
  "kalan tüm hukuki, idari ve cezai sorumluluk tarafınıza aittir. AURA, kendisi dışında gerçekleştirilen " +
  "anlaşmalardan hiçbir şekilde sorumlu tutulamaz.";

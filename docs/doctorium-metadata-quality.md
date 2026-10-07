# Doctorium içerik künyesi — D06 kabul ölçütleri

Bu kontrol **inceleme bulgusu** üretir. Kaynak metnini değiştirmez; içerik kabulünü, DOI dedup'ını veya erişimi belirlemez. `no-local-finding` kaynak doğrulaması/klinik doğruluk onayı değildir.

| Kabul ölçütü | Kontrol / kanıt |
| --- | --- |
| Kısa başlık tek başına kusur değildir | DNA, Editorial, A ve diğer kısa başlıklar uyarısız; uzunluk eşiği yok. |
| 2026 reaffirmed kılavuz eski kanıta dayanabilir | 2026 başlık/DOI ile 2024 tarih alanı otomatik uyuşmazlık oluşturmaz; yıl eşitliği şartı yok. |
| Kaynak eksik başlık insan incelemesine açılır | Detection of / Effect of gibi tamamlanmamış ifadeler `human-review`; repair=null; kabul/dedup korunur. |
| DOI ve DOI URL kimliği ayrıdır | Sözdizimi veya bağlantı uyuşmazlığı bildirilir; kaynak değeri değişmez. DOI bulunmayan makale engellenmez. |
| Özgün veri çeviriden ayrıdır | Referans özgün titleOriginal'a, yoksa title'a karşılaştırılır; Türkçe gösterim başlığı özgün referansla eşit olmak zorunda değildir. |
| Referans eşleşmeden tam başlık önerilmez | Farklı DOI/eksik güvenli kaynak adresinde source-title-mismatch üretilmez; identity-unconfirmed verilir. |
| Yayın ve ingest tarihi karışmaz | publishedAt yayın alanı; createdAt yerel aktarım zamanı. Tarihler değiştirilmez, boş tarihler doldurulmaz. |
| Tarih hassasiyeti açıktır | DOAJ yıl/ay veya sağlayıcı-created-date yedeği inceleme bulgusunda belirtilir; ayın ilk günü doğrulanmış yayın günü sayılmaz. |
| Kalite kontrolü ingest'i düşürmez | Uyarı sink'i hata verse bile kayıt kabulü sürer; frozen metadata değişmez. |
| Eski satır otomatik onarılmaz | Uyarı DOI dedup'dan önce çalışır; mevcut DB satırına title update, hide veya delete eklenmez. |

Saf API: `inspectArticleMetadata(metadata, optionalVerifiedReference)`. Referans bağımsız birincil kaynaktan insan tarafından doğrulanmış olmalıdır; kaynak sağlayıcının kendi eksik başlığı ikinci kanıt sayılamaz. Helper ağ/AI/DB kullanmaz ve onarım üretmez.

Pipeline: PubMed, Europe PMC ve DOAJ ingest yolları `reportArticleMetadataQuality` çağırır. Varsayılan çıktı `[doctorium-metadata-review]` log olaylarıdır; source, externalId ve bulgu kodu/alan/açıklama taşır. Uyarı kaynağın başlığı veya hassas query/credential içerebilecek URL'yi loglamaz. Şema değişmedi; yeni admin kuyruğu veya kalıcı bulgu tablosu oluşturulmadı. Deployment yapılana kadar canlı pipeline bu değişikliği kullanmaz.

PubMed online-publication kökeni yalnız mevcut ayrıştırılmış epubdate gerçekten saklanan güne eşitse işaretlenir; aksi halde unknown. Europe PMC firstPublicationDate; DOAJ yıl/ay veya sağlayıcı kayıt zamanı kökeni açıkça ayrılır. `createdAt` ingest'ten önce bilinmiyorsa null kalır; kontrol için yeni damga üretilmez. Bu metadata provenance bilgileri kontrol çıktısındadır, DB'ye yeni alan yazılmaz. Mevcut tarih hesaplama ve gelecek tarih kırpma davranışı bu işte değiştirilmedi.

İnceleme akışı:

1. Logdaki yalnız ilgili source/externalId için yetkili metadata okuması veya seçili alan export'u alınır. Toplu kullanıcı/sağlık verisi sorgulanmaz.
2. DOI, yayıncı/NLM künyesi ve upstream kaynak eşleştirilir. Yayın yılı, online/sayı tarihi, aktarım tarihi ayrı değerlendirilir.
3. Aynı DOI'nin tam özgün başlığı kanıtlanırsa hedefli offline dry-run önerisi hazırlanır. D04 bunun örneğidir: bozuk DOAJ title, gerçek eski metadata ve tam başlık kanıtı; otomatik kesin onarım yok.
4. Yazma gerekirse exact id/source/externalId/DOI/eski değer/updatedAt veya uygun CAS şartıyla tek satır önerisi ayrı onaylanır. Özet, çeviri, yayın ve ingest tarihleri gerekçe olmadan değiştirilmez. Yeniden ingest veya toplu seed onarım yerine kullanılmaz.

Testler: `article-metadata-quality.test.ts` (27), `article-metadata-ingest.test.ts` (3). Gerçek DOAJ ingest fonksiyonu, mock fetch/DB/çeviri ve sabit saatle kaynak kusurunu bildirirken create/dedup davranışını korur. Canlı provider key, AI ücretli çağrı veya üretim DB işlemi testte kullanılmaz.

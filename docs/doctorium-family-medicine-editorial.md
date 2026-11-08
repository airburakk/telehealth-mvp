# Aile Hekimliği editoryal inceleme ve yayın protokolü

## Mevcut teslim
- Rapor hazırlığı: sürücü, işe giriş, evlilik öncesi, askerlik ve istirahat.
- ASM hazırlığı: soğuk zincir kayıtları, malzeme/miat, cihaz bakım, hijyen ve personel eğitim kayıtları.
- Ekran, yalnız kaynak incelemesine hazırlık soruları gösterir. Klinik karar, sevk/tetkik listesi, denetim sonucu, rapor belgesi veya hasta çıktısı üretmez.
- İşaretler React belleğinde geçicidir. Ağ isteği, hasta alanı, yükleme, localStorage veya veri tabanı kaydı yoktur.

## Her başlığın tamamlanması için gerekli kanıt
1. Yetkili editör özgün kaynak URL'sini, sürümünü, madde/sayfa konumunu, uygulanabilir kapsamını, yürürlük başlangıcını ve varsa bitişini kaydeder.
2. Kaynak kontrol tarihi gerçek kontrol günü olmalıdır. Genel duyuru ilgili maddeyi doğrulamak yerine geçmez.
3. Hekim ve hukuk incelemesi ayrı isim/tarih ile belgelenir. İncelemeler son kaynak doğrulamasından eski olamaz. Burada kimse adına onay oluşturulmadı.
4. Sonraki inceleme günü ve içerik statüsü belirlenir. Süresi dolan veya doğrulanamayan içerik kapalı kalır.
5. İkinci kişi diff ve kaynak maddelerini inceler; testler ve normal kod inceleme/yayın süreci tamamlanır.

`workflowPublicationGate` bu içerik koşullarını doğrular. Kimlik doğrulama, imza veya yayın yetkisi sistemi değildir. Yönetim inceleme ekranı /admin/aile-hekimligi ve API /api/admin/aile-hekimligi eklendi. Kaynak kanıtı kaydedilebilir; uzman incelemesi için mevcut ADMIN rolüne ek, süresi geçerli ve niteliği belgelenmiş ayrı uzman yetkisi gerekir. Migration uygulanmadı, hiçbir uzman yetkisi veya onay kaydı oluşturulmadı. Tüm kamuya dönük katalog taslak kalır. İstemci onayı veya kutu işaretleme bu kapıyı açamaz.

## 7 Kasım 2026 kaynak incelemesi
- Sağlık Bakanlığı duyurusu: Sağlık Raporları Yönetmeliği 19 Mayıs 2026 / 33258 RG. Duyuru içerik ve tarihi okundu, rapor türlerine özgü bütün maddeler incelenmedi.
  https://shgmmevzuatdb.saglik.gov.tr/TR-117242/saglik-raporlari-yonetmeligi-yayimlandi.html
- Bakanlığın 2 Temmuz 2026 duyurusu, 2019 yönergesinin 26 Haziran 2026 Makam Oluru ile kaldırıldığını bildiriyor. Eski yönerge kaynak kuralı olarak kullanılmaz.
  https://shgmsgudb.saglik.gov.tr/TR-118487/saglik-raporlari-usul-ve-esaslari-hakkinda-yonerge-yururlukten-kaldirilmistir.html
- Bingöl İl Sağlık Müdürlüğü 2 Kasım 2026 sayfası, DENİZ'de 1 Eylül 2026'dan beri kullanılan ASM/AHB form sürümünü açıklıyor. Formlar bilgilendirme amaçlı; gerçek izleme DENİZ üzerinden. Tek tek kriter eşleştirmesi tamamlanmadı.
  https://bingolism.saglik.gov.tr/TR-396607/aile-hekimligi-izleme-ve-degerlendirme-formlari.html

## Gerçek kalan engeller
- Her rapor/ASM başlığına özel madde ve istisna eşleştirmesi, yerel uygulanabilirlik ve kaynak değişiklik taraması.
- Yetkili hekim/hukuk inceleyenlerinin gerçek onayları.
- İnceleyen kişilerin niteliğinin doğrulanması ve açık yetkilendirme; migration sonrası gerçek veritabanı testleri.
- Türkiye ilaç kaynakları lisansı/API izni; bağımsız pilot ve yayın onayı.

Hasta verisi veya tıbbi karar kuralları bu eksikleri taklit ederek tamamlanmaz. Üretime yayın yapılmadı.

## Üçüncü aşama: yönetim paneli ve audit
- Kaynak sürümü, madde/sayfa, uygulanabilirlik ve yürürlük alanları için sınırlandırılmış editör.
- Revizyon çakışmasında 409; yanıt belirsizse otomatik tekrar yok, sunucu kaydı tekrar okunur.
- Kaynak kanıtı değişince iki uzman incelemesi de sıfırlanır. ADMIN, tek başına uzman yeterliliği sayılmaz; hekim ve hukuk incelemesini farklı kişiler yapar.
- Kaydın tam snapshot'ı ve hash'i, aktör/zaman/revizyon ile aynı transaction içinde zorunlu audit olayına yazılır. Audit yazımı hata verirse işlem başarısızdır.
- Migration, olay tablosunda UPDATE/DELETE/TRUNCATE işlemlerini reddeder. Veritabanı sahibine karşı harici noterlik veya değiştirilemezlik garantisi verilmez.
- Hiçbir panel eylemi klinik içeriği yayınlamaz veya mevcut public kataloğu değiştirir. İnceleme kaydı yayın yetkisi değildir.
- Hasta bilgisi girmek yasaktır; serbest metin alanlarının teknik olarak her türlü metni kabul edebileceği unutulmamalı. Form ve audit yalnız genel kaynak kanıtı içindir.

### Kurulum ve doğrulama sınırı
Migration dosyası hazır; hiçbir veritabanına uygulanmadı. Kurulmamış tabloda API SCHEMA_MISSING/503 döner ve UI kaydetme/incelemeyi kapatır. Hiçbir kullanıcıya grant verilmedi. Gerçek DB transaction rollback ve append-only trigger testleri bağımsız test veritabanında ayrıca yapılmalı; mock testi bunların kanıtı değildir. Üretim yayını yok.

### Kabul testleri (migration uygulandıktan sonra)
1. Ayrı, boş test veritabanında migration'ları uygula; üretim bağlantısı kullanma.
2. Yetkisiz ve doktor oturumu 401/403, sahte aktör alanı 400, yabancı origin 403 olmalı.
3. Kanıt kaydını değiştirince revizyon artmalı, iki inceleme de silinmeli; eski revizyon 409 olmalı.
4. Yetkisiz/süresi dolmuş/revoked grant inceleme kaydedememeli; aynı kişi iki disiplini onaylayamamalı.
5. Audit insert hatası enjekte edildiğinde kanıt/inceleme değişikliği de rollback olmalı.
6. Audit UPDATE, DELETE ve TRUNCATE DB tarafından reddedilmeli.
7. Katalog veya kaynak hash'i değişince eski inceleme yeniden kayıt gerektirmeli.
8. Yanıt kaybından sonra UI otomatik tekrar göndermemeli; sunucu okuması istenmeli.
9. Bu adımlar hiçbir public içeriği yayınlamamalı.

Gerçek veritabanında bu kabul testleri henüz yapılmadı. Yetki ataması, kimlik/nitelik doğrulaması ve kullanıcı onayı olmadan yapılmaz.

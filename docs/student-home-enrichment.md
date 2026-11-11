# Student ana ekranı ve kulüp etkinlikleri

Son yerel doğrulama: 11 Kasım 2026.
Dal: `feat/student-club-radar-20261109`.

## Tamamlanan geliştirme

- Öğrenci hesabında Akışım “Öğrenci gündemin” başlığıyla açılır.
- “Öğrenci masan” mevcut TUS, burs/staj/değişim fırsatları, kaydedilenler ve takvim sayfalarına doğrudan bağlanır. Veri veya özellikler ikinci bir depoda çoğaltılmaz.
- Yaklaşan tarihler mevcut `doctorCalendarMonth` üzerinden bu ay ve sonraki ay için okunur. TUS tarihleri, onaylı EDU son başvuruları, takip edilen etkinlikler ve hesabın kendi kayıtları yer alır. En fazla beş kayıt gösterilir.
- Aylar arasında tekrarlar elenir. Devam eden etkinlikler korunur ve tam gün bağlantısı açılır. Ortak takvimle aynı UTC gün anahtarı kullanılır; tarih üretilmez veya tahmin edilmez.
- Yükleme hatası ile boş takvim ayrı mesajlarla anlatılır.
- Ana akış ve sayaç alt sayfası Student için doktor kariyer yollarını sorgulamaz. Kariyer imleci tüketildi işaretlenir; boş sayfa döngüsü oluşmaz. Doktor akışı korunur.
- Aile Hekimliği çalışma alanı çağrısı Student akışında gösterilmez.
- Hesap menüsü kanonik STUDENT hesabını “Tıp Öğrencisi” olarak etiketler. NONE/LOCKED durumundaki öğrenci başvurusu etiketi korunur; VERIFIED eski öğrenci bayrağını geçersiz kılar.
- Mevcut kulüp etkinliği bileşeni ana sayfada en fazla üç etkinlikle gösterilir. Etkinlik sekmesinde tam liste korunur; bileşenin kendi öğrenci kitle kontrolü vardır.

## Kulüp otomasyonu

Mevcut pilot yeniden yazılmadı veya kapsamı sessizce genişletilmedi. Tek resmî kaynak ESOGÜ SKS’dir. Kaynak/tarih/tekrar ve iptal kontrolleri, 36 saatlik tazelik sınırı, günlük 02:37 UTC (05:37 Türkiye) AURA cron’u ve varsayılan kapalı özellik bayrağı korunur.

Ayrıntılı kaynak ve rollout sözleşmesi: [kulüp pilotu](student-club-events-pilot.md).

## Doğrulama

- 245 dosyada 2.848 birim testi geçti.
- ESLint ve Next.js derlemesi geçti.
- TypeScript ayrıca derleme tamamlandıktan sonra kontrol edildi. Derleme ile aynı anda çalıştırılan ilk ek kontrol, Next’in yeniden oluşturduğu routes tip dosyasına denk geldi; bu nedenle son kontrol seri yürütüldü.
- İzole TEST_DATABASE_URL üzerinde kulüp otomasyonunun 5 entegrasyon testi geçti. Üretimle aynı uç nokta ve üretim parmak izi reddedildi; yalnız sentetik satırlar kullanıldı.
- `scripts/qa-student-home.ts`: gerçek yerel Next.js sunucusu ve sentetik öğrenci oturumuyla dört bağlantı, kendi takvimi, başka hesabın takviminden yalıtım, üç etkinliklik önizleme, tam etkinlik listesi, Kariyer ayrımı, doktor ve anonim erişimi kontrol edildi.
- Chrome’da 390×844 mobil ve 1440×1000 masaüstü görünümü kontrol edildi. Yatay taşma yok. Ana ekran ve kulüp kartları gece/gündüz temalarında okunaklı.
- TUS, burs/staj, kaydedilenler ve takvimde doğru gün bağlantıları açıldı. Geri ile ana ekrana dönüş ve hesap menüsünü Escape ile kapatma doğrulandı.
- Hesap etiketi düzeltmesi derlemeden sonra tarayıcıda yeniden görüldü.
- Bağımsız kod incelemesinde bulunan sayaç yolu ve öğrenci etiketi sorunları düzeltildi ve tekrar incelemede kapandı.

Derleme üretim sırları olmadan, geçici yerel anahtarlar ve bağlantısı olmayan localhost DB ile çalıştırıldı. Mevcut DICOM dinamik çözümleme uyarısı ve halka açık sayfalardaki beklenen DB/fixture uyarıları yeni Student işinden kaynaklanmıyor.

Tarayıcı kanıtları yalnız yerel sentetik testtir, canlı yayın kanıtı değildir. Test kayıtları temizlenir ve sunucular kapatılır.

## Üretim durumu

Kod yerelde tamamlandı. GitHub push/PR, üretim migration, özellik bayrağı değişikliği ve deploy yapılmadı.

Ana ekranın takvim/kısayol alanı ek migration gerektirmez. Kulüp tarafındaki `20261109180000_student_club_events` migration yalnız `StudentClubEvent` tablosu ile iki indeks oluşturur; mevcut öğrenci veya klinik tablolara dokunmaz. Geri alma için özellik bayrağı kapatılıp önceki uygulama sürümüne dönülebilir; tablo silmek gerekmez.

Yayın sırasında sıra:
1. İnceleme isteği ve son commit’e ait CI.
2. Eklemeli migration’ın kontrollü uygulanması.
3. İncelenen commit’in AURA ve Doctorium projelerinde dağıtımı.
4. `STUDENT_CLUB_EVENTS_ENABLED` bayrağının ilgili üretim projelerinde kontrollü açılması.
5. Yetkili cron koşusu, kaynak/audit sonucu ve canlı öğrenci ekranının doğrulanması.

Yeni tıbbi içerik üretilmedi; mevcut içeriklere uzman doğrulaması atfedilmedi.

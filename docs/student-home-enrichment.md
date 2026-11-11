# Student ana ekran zenginleştirmesi

Tarih: 11 Kasım 2026. Dal: `feat/student-club-radar-20261109`.

## Yerelde tamamlanan kapsam

- Akışım, öğrenci hesabında “Öğrenci gündemin” başlığı ve “Öğrenci masan” alanıyla açılır.
- TUS, burs/staj/değişim, kaydedilen içerikler ve takvim mevcut sayfalara bağlanır. İkinci bir veri deposu veya kopya ekran oluşturulmaz.
- Yaklaşan tarihler mevcut `doctorCalendarMonth` üzerinden bu ay ve sonraki ay için okunur: TUS, onaylı EDU son başvuruları, takip edilen etkinlikler ve hesabın kendi kayıtları. En fazla beş kayıt gösterilir. Aylar arasında tekrarlar elenir; devam eden etkinlikler korunur ve ilgili gün açılır.
- Tarih uydurulmaz. Boş takvim ile yükleme hatası ayrı mesajlardır. Ortak takvimle aynı UTC gün anahtarı kullanılır.
- Öğrenci akışında doktor kariyer yolları sorgulanmaz. İmleç açıkça tüketildi işaretlenir; boş sayfa döngüsü oluşmaz. Doktor akışı değişmez.
- Aile Hekimliği çalışma alanı çağrısı öğrenci akışında gösterilmez.
- Önceden hazırlanmış öğrenci kulübü modülü ana sayfada en fazla üç etkinlikle özetlenir; Etkinlik sekmesinde tam liste korunur. Bileşenin kendi öğrenci kitle kontrolü vardır.
- Kulüp bayrağı varsayılan olarak kapalı kalır. Otomasyon ve kaynak kapsamı bu çalışmada genişletilmemiştir; tek resmî kaynak ESOGÜ SKS’dir. Ayrıntılar: [kulüp pilotu](student-club-events-pilot.md).

## Doğrulama

11 Kasım 2026 tarihinde:

- `npm test -- --reporter=dot`: 243 dosya, 2.840 test geçti. Yeni ana ekran/akış testleri 21 testtir.
- `npx tsc --noEmit`: geçti.
- `npm run lint`: geçti.
- `npm run build`: geçti. Üretim sırrı kullanılmadı; geçici yerel anahtarlar ve bağlantısı olmayan localhost DB ile çalıştırıldı. Mevcut DICOM dinamik çözümleme uyarısı ile halka açık sayfalarda beklenen fixture/DB uyarıları görüldü.
- Ayrı, mevcut TEST_DATABASE_URL üzerinde `tests/integration/student-club-events.test.ts`: 5 test geçti. Üretim uç noktasıyla aynı olmadığını ve üretim parmak izi taşımadığını kontrol eden dış koşucu kullanıldı. Yalnız sentetik test kayıtları oluşturulup temizlendi.
- `scripts/qa-student-home.ts`: gerçek yerel Next.js sunucusu ve sentetik öğrenci oturumunda HTTP kontrolü geçti. Dört bağlantı, kendi takvim tarihi, başka hesabın takviminden yalıtım, üç etkinliklik önizleme, tam etkinlik listesi, Kariyer ayrımı, doktor ve anonim erişim ayrımı kontrol edildi. Test hesapları/kayıtları temizlendi ve sunucu kapatıldı.

Bu HTTP kontrolü yeni arayüzün mobil/masaüstü tarayıcı görsel testi değildir. Önceki kulüp modülünün görsel testleri yeni ana ekranın görsel testi olarak sayılmamalıdır.

## Üretim durumu ve sonraki adım

Bu çalışma yerel geliştirmedir; GitHub’a push, PR, üretim migration, bayrak değişikliği veya deploy yapılmadı. Yeni tıbbi içerik üretilmedi ve içeriklere uzman doğrulaması atfedilmedi.

Yayın izni kapsamında izlenecek sıra:

1. İnceleme isteği ve CI; yeni Student ana ekranının mobil/masaüstü kabul kontrolü.
2. Kulüp tablosu için önceden hazırlanmış eklemeli migration’ın üretimde kontrollü uygulanması.
3. İncelenen commit’in AURA ve Doctorium projelerinde dağıtımı; ilgili ortam bayrağının kontrollü açılması.
4. Yetkili cron koşusu, kaynak/audit sonucunun kontrolü ve canlı öğrenci hesabıyla son kabul.

Ana ekranın yeni takvim/kısayol alanı ek migration gerektirmez. Kulüp otomasyonu ise ayrı tablosu ve bayrağı hazır olmadan etkinleştirilmemelidir.

# Aile hekimliği DEV veritabanı doğrulaması — 8 Kasım 2026

## Ortam ve migration
- `.env` DATABASE_URL/DIRECT_URL hedefinin aynı DEV endpoint olduğu, PROD endpoint'inden farklı olduğu doğrulandı. Sırlar kaydedilmedi.
- PROD yalnız salt okunur incelendi. Bu çalışmada PROD migration, veri veya yetki değişikliği yapılmadı.
- Eski social_metric_daily checksum farkı CRLF checkout kaynaklıydı: dosya Git HEAD/LF ile eşitlenince DEV ve PROD kayıtlarıyla eşleşti; DB kaydı değiştirilmedi.
- DEV ai_usage_daily eski checksum farkı ayrıca vardı. Tüm kolonlar/default/nullability ve PK/unique/day indeksleri mevcut migration DDL ile birebir karşılaştırıldı; runbook `fix-migration-checksum.mjs` ile yalnız DEV muhasebe checksum'ı hizalandı. PROD'a bu işlem uygulanmadı.
- 20261107220000_family_medicine_editorial ve 20261108010000_family_medicine_source_checks DEV'e uygulandı. İki migration eklemeli, explicit transaction içinde. DEV 66 migration / sıfır checksum farkı / sıfır failed / sıfır pending.
- Applied migration dosyaları artık değiştirilmemeli. Yeni gereksinim yeni migration olmalı.

## Gerçek PostgreSQL kanıtı
`tests/integration/family-medicine-editorial.integration.test.ts`: 8/8 geçti.
- Gerçek evidence + snapshot ledger yazımı ve stale revision reddi.
- PostgreSQL trigger ile audit UPDATE, DELETE, TRUNCATE reddi.
- Gerçek ledger unique constraint ihlalinde evidence işleminin rollback edilmesi.
- Güncel DB rolü, grant yokluğu/iptali ve kaynak fingerprint değişikliği için ret.
- İki ayrı SERIALIZABLE transaction aynı expectedRevision için yarıştı: biri kazandı, diğeri P2034 write conflict aldı.

İlk 7 davranış testinde test kullanıcısı, uzman grant'i, kaynak durumu ve audit/evidence fixture'ları yalnız outer transaction içinde yaşadı; callback sonunda zorunlu rollback edildi. Uygulamanın transaction çağrısı testte bu gerçek outer transaction'a yönlendirildi; SQL/constraint/trigger mock değildir. Concurrency testi sadece rastgele ID'li, katalog dışı tek editorial fixture satırı kullandı; finally'da tam ID ile temizlendi. Gerçek iş akışı, kullanıcı, onay veya audit kaydı silinmedi. Son sayımlar önceki değerlerle aynı; fixture kullanıcı/grant/event kalmadı.

## Güvenli tekrar çalıştırma
Yerel runner `.env` DEV URL'sini yalnız alt süreç TEST_DATABASE_URL'ine aktarır; `FAMILY_MEDICINE_DEV_DB_TEST=1` ayrıca gerekir. Test PROD hostuyla eşleşirse reddeder; driver workflow kaydı varsa üstüne yazmak yerine durur. Günlük production test olarak çalıştırılmamalıdır.

## Yayın öncesi sınır
PROD'a eklemeli migration parent tarafından ayrıca uygulanmalı; migration önce, kod push/deploy sonra. Code rollback gerekirse yeni kullanılmayan tabloları yerinde bırakmak mevcut veriyi korur; yeni tabloları/drop etmek rollback planı değildir. DEPLOY.md PITR mekanizmasını belgeliyor ancak son kaydedilmiş prova 3 Temmuz 2026; bu çalışma yeni PITR restore provası veya tam hassas DB dump'ı üretmedi. DB sahibinin DDL yetkisi audit trigger'ını değiştirebilir; harici noter/tamper-proof garantisi iddia edilmez.

## Canonical SQL satır sonları
Yeni iki migration uygulandıktan sonra Windows CRLF / Git LF checksum riski ayrıca doğrulandı. SQL içeriği satır sonları dışında aynı kalacak şekilde LF canonical yapıldı; `.gitattributes` yalnız bu iki dosya ve social_metric_daily için `eol=lf` sabitler. Diğer geçmiş migration dosyaları değiştirilmedi. Yeni iki migration'ın DEV checksum muhasebesi runbook aracıyla canonical LF hash'ine hizalandı. PROD checksum alanına yazılmadı. Bu işlem DDL'yi tekrar çalıştırmadı veya veri değiştirmedi; gerçek DB testlerinin sınadığı şema aynıdır.

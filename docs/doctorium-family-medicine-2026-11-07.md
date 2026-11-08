# Doctorium aile hekimliği: ilk uygulama

## Uygulananlar
- Aile Hekimliği: doktor taksonomisi, kayıt ve uzmanlık düzeltme seçeneği; hasta triyajı/prosedür fiyatları değişmedi.
- Pratisyen Hekim (Uzmanlık Yok): uzmanlık beyanına zorlamayan kayıt seçeneği.
- doctoriumViewPrefs.practice.setting: isteğe bağlı ASM/birinci basamak, eğitim/araştırma, diğer. Mevcut uzmanlığı veya akış tercihlerini değiştirmez; migration gerekmez.
- /doktor/doctorium/aile-hekimligi: mevcut erişim kapısıyla korunan kaynak rafı ve akademik/hukuk/etkinlik/Post bağlantıları.
- Akademik sorgu, dergi eşlemesi, ikon/renk ve hukuk anahtar kelimeleri.

## Doğrulama
- 221 test dosyası / 2605 birim testi geçti.
- TypeScript ve tam ESLint geçti.
- Yerel üretim derlemesi geçti. Önceden var olan dicom-pixels.ts dinamik require uyarısı mevcut.
- localhost:3011 kayıt ekranında iki yeni seçenek görüldü, Aile Hekimliği seçildi.
- Oturumsuz çalışma alanı girişe yönlendi; dev demo hesabı girişinden sonra kaynak rafı ve tercihler ekranı render edildi.
- Önceki tarayıcı oturumundaki etkileşim engeli izole Chrome testinde tekrarlanmadı. Masaüstü ve dokunmatik mobil (390 × 844) E2E geçti: kayıt/yenileme, çalışma alanı bağlantısı, geri/ileri, hızlı ardışık seçimde son değerin korunması, tercih kaldırma ve yatay taşma kontrolleri. Tarayıcı çalışma zamanı hatası yok. Test demo tercihi eski haline döndürüldü.
- Hiçbir üretim veri taşıma, commit, push veya deploy yapılmadı. Akademik içerik ingest/backfill çalıştırılmadı.

## Kalan kapsam
- Gerçek cihaz ve bağımsız kabul testi; E2E: E2E_BASE_URL=http://localhost:3011 E2E_BROWSER_CHANNEL=chrome npx playwright test family-medicine.e2e.ts --project=chromium. Yerel sunucu/dev veritabanı gerekir.
- Aile hekimliği kaynaklarının güncel sürüm/editör yaşam döngüsü; ASM değişiklik kartlarının editoryal modeli.
- Rapor işlem yardımcısı ve ASM kontrol listeleri için kaynak maddelerinin hekim/hukuk incelemesi.
- Türkiye ilaç kaynaklarının lisans ve entegrasyon değerlendirmesi.
- 8–12 hekim pilotu: dış iletişim öncesi alıcılar ve metin onayı.
- Üretime yayın öncesi bağımsız inceleme, CI ve yayın yetkisi.

Bu sürüm klinik karar motoru değildir; hasta kimliği veya dosyası toplamaz. Kaynak rafı bağlantıları genel başvuru amaçlıdır; klinik kural doğrulaması yapıldığı iddia edilmez.
## Kaynak inceleme durumu
Kaynak kartlarında sürüm kontrolü, teknik bağlantı kontrolü ve klinik editör incelemesi ayrı gösterilir. Bu üç inceleme tamamlanmadı; tarih, editör veya klinik onay uydurulmadı. Teknik erişilebilirlik klinik güvence yerine geçmez.



## İkinci uygulama: eksiklerin güvenli tamamlanması
Rapor/ASM hazırlık masası, beşer taslak konu ve geçici hazırlık işaretleri eklendi. Klinik uygulama hâlâ kapalı; kaynak maddesi/uygulanabilirlik, sürüm/yürürlük, hekim-hukuk incelemesi ve yeniden inceleme tarihi yayın koşulları olarak test ediliyor. Hasta verisi alanı ve kalıcı kayıt yok. 2026 rapor yönetmeliği, eski yönergenin kaldırılması ve güncel ASM form duyuruları ayrı kaynaklar olarak eklendi; duyuru düzeyinde 7 Kasım 2026 kontrolü yapıldı. Bu, klinik madde onayı değildir. Ayrıntılar: doctorium-family-medicine-editorial.md.
Son ikinci-aşama test sonucu: 222 dosyada 2638 birim testi ve masaüstü/dokunmatik mobil 2 E2E geçti; TypeScript ve ilgili lint temiz. E2E yeni başlık seçimi, geçici işaretlerin sıfırlanması, yayın engeli görünürlüğü ve hasta alanı bulunmamasını da kapsıyor.

## Üçüncü uygulama: yönetim incelemesi
/admin/aile-hekimligi yönetim paneli ve API, sürümlü kanıt/onay modelleri, ayrı uzman yetkileri ve zorunlu transaction audit eklendi. Kaynak adayları 5 ASM ve 4 rapor için editöre gösterilir; askerlik özel madde kanıtı eksiktir. Migration hazırlanmış ama uygulanmamıştır; hiçbir uzman yetkisi/onay oluşturulmamıştır. Gerçek kalıcılık/DB trigger testleri bekler. 3 gerçek API erişim testi ve 5 mock UI E2E başarılıdır; mock testler kalıcı kayıt kanıtı değildir. Detaylı kabul planı doctorium-family-medicine-editorial.md dosyasında.
Son regresyon: 224 dosyada 2670 birim testi geçti. 3 gerçek API erişim testi ve 5 mock yönetim UI testi geçti. Tam lint ve TypeScript temiz. Windows Prisma DLL kilidi sunucu durdurularak giderildi; generate başarılı.

## Dördüncü uygulama: açık kişiselleştirme bağlantısı
Özelleştir ekranında ASM çalışma alanı veya Aile Hekimliği uzmanlığı için ayrı 'Aile Hekimliğini akış tercihlerime ekle' eylemi eklendi. Çalışma alanını seçmek tek başına branş eklemez. Açık eylem mevcut branşları, boş listede uzmanlık varsayılanını korur; 30 branş sınırında kırpmadan hata verir. Branşsız genel görünümün daralacağı açıklanır. Kapalı modüller ve Post/e-posta aboneliği açılmaz. Akış çalışma alanı bağlantısı ASM/ilgili uzmanlık için kişiselleştirilir, içerik zorla eklenmez.

Post zaten effectiveBranches ve seçili modülleri kullanıyordu; ayrı gönderim motoru eklenmedi. Üç regresyon testi, açık tercihlerin Post sorgusuna taşındığını, ASM seçiminin kendiliğinden etkisiz olduğunu ve kapalı Akademik modülünün korunmasını doğruluyor. Kongre hatırlatmalarının Post'a eklendiği iddia edilmez. Mock arayüz E2E, ayrı açık eylem olmadan branş yazılmadığını ve abonelik çağrısı yapılmadığını doğruladı; gerçek kullanıcı tercihi değiştirilmedi.
Kişiselleştirme sonrası son regresyon: 225 dosyada 2681 birim testi, açık eylem için 1 mock E2E, tam lint ve TypeScript başarılı.

## 2026-11-08 — Signup work setting and release hold

User decision: Family Medicine remains a Doctorium workspace, work setting is asked during registration separately from specialty, feed inclusion remains explicit opt-in, and the entire release waits for review. User offered to review the material; no clinical/legal qualifications or reviewer grants are assumed.

Implemented optional `PracticeSettingSelect` in classic doctor registration, trial registration, and OAuth profile completion. Shared account creation persists only an explicitly selected allowlisted setting in `doctoriumViewPrefs.practice.setting`. No specialty, news branch, email subscription, or digest default is changed. Existing-account trial retries do not write this preference. OAuth loads the saved selection and sends the property only after interaction; the server locks the doctor row and merges the setting without replacing other preference modules.

Verification: 228 unit files / 2715 tests passed; TypeScript passed; full source lint passed. Four local Playwright signup cases passed (classic/trial x desktop/390px mobile): optional blank default, explicit choice, no automatic preference API call, rejected-submit retention, clearing selection, navigation back and reload, and no horizontal overflow. Signup API calls were intercepted; these UI checks did not create accounts or send email. Route/account unit tests use mocks, not a real database transaction. OAuth UI itself has not been exercised with a newly created OAuth account; server behavior is covered by mock tests.

No migration applied, no clinical or legal approval recorded, no reviewer grant provisioned, no commit/push/deployment performed. Existing local changes preserved. Whole-release hold remains in effect.
Final local build passed (2026-11-08). Existing unrelated DICOM dynamic require warning remains at src/lib/dicom-pixels.ts:100. No deployment.

## 2026-11-08 — Release authorization and recurring source checks

The user explicitly requested the family-medicine package go live and use Doctorium's existing refresh mechanisms. This supersedes the earlier whole-release hold for the implemented workspace, preferences, source directory and clearly labeled preparation drafts. It does NOT attest clinical/legal review or create reviewer grants; clinical decision rules remain unpublished.

Implemented `/api/cron/refresh-family-medicine` at 03:10 UTC (06:10 Türkiye), through the existing AURA-only cron guard and shared DB. Nine curated source URLs are fetched with time/size/redirect/content checks; PDF bytes and normalized HTML plus meaningful links are fingerprinted. Technical attempts, successful checks, changes and staleness remain separate from editorial approval. Source content changes, unreachable/unchecked sources or checks older than 72 hours block reviews; saved evidence is tied to observed source fingerprints. Arbitrary evidence URLs are not fetched and cannot be approved unless included in the monitored manifest.

The existing PubMed/Europe PMC/DOAJ branch queries and journal filters cover academic ingestion; legal/events/Post retain their own pipelines and explicit user preferences. This does not add complete TAHUD/AHEF congress ingestion, a licensed TİTCK feed, exhaustive new-law discovery, or automatic rewriting of every historical article/AI summary. The UI states these limits.

Validation before release: 8 real DEV PostgreSQL tests (audit immutability, rollback, auth/grant/fingerprint checks and serializable concurrency); 16 local family-medicine UI/access scenarios passed across the final runs (trial flag explicitly enabled for trial signup tests). Source status mobile screenshot visually checked. All nine actual public sources validated from the local DEV runner; the RG Windows-1254 page required correct decoding. A historical DEV TAHUD changed flag was retained rather than erased; two subsequent source reads were stable.

PROD additive migrations applied and verified: 66/66 migrations, zero mismatch/failed/pending; four FamilyMedicine tables, sourceFingerprint column and audit triggers present. No reviewer grants exist. No existing table data was rewritten. Earlier DEV-only checksum alignment and LF normalization details remain in the DB verification report. Current PITR restore rehearsal was not performed. Rollback plan is code rollback to prior deployments while preserving new tables and audit history, not dropping data.

Prior rollback candidates: Doctorium dpl_4PPvTT222YM2ESPsn6BQbQfC5usb, AURA dpl_DrpNoQy6gKouc1K3yH7euExxJf6u; both commit b514dee105bea973a1f29a2c8400cc3f8c250d48. Production publication and server-side cron execution still require verification after this preparation record.

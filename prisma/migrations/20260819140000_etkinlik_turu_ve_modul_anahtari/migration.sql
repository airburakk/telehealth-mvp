-- v6.120 (kullanıcı kararı 2026-08-19): Doctorium "Kongre" modülü → "Etkinlik".
-- İki ayrı iş tek migration'da, çünkü ikisi de aynı kullanıcı kararının parçası:
--   (1) MedicalCongress'e TTB etkinlik TÜRÜ + akredite etkinlik KODU alanları,
--   (2) modül anahtarının kongre → etkinlik göçü (doktorun akış tercihi JSON'unda yaşıyor).
--
-- Dayanak: vault `output/ste-kredilendirme-arastirmasi-2026-08-19.md` §5.1 — TTB'nin akredite
-- etkinlik kaydındaki 9 tür (kod öneki): KNG kongre · SMP sempozyum · KRS kurs · EGT eğitim ·
-- KNF konferans · CAL çalıştay · SMN seminer · GRP atölye · DGR diğer.
--
-- ⚠️ (2) NEDEN ZORUNLU — sessiz kayıp koruması:
-- `Doctor.feedModules` bir JSON string[] ("[\"kongre\",\"akademik\"]"). parseFeedModules
-- FAIL-OPEN çalışır: tanımadığı anahtarı sessizce ATAR. Bu satırı yazmazsak, akış tercihinde
-- "kongre" seçmiş her doktor Etkinlik bölümünü akışından KAYBEDER — hata da vermez.
-- Tercihe hiç girmemiş doktorda alan NULL'dur (= tümü); replace NULL'a dokunmaz, doğru davranış.
--
-- ⚠️ eventType DEFAULT 'kongre': mevcut küratörlü kayıtların hepsi gerçekten kongre
-- (scripts/seed-congresses.ts, 30 branş kongre rehberi) — varsayılan onları doğru etiketler.
-- TTB ingest'i kendi türünü AÇIKÇA yazar, varsayılana güvenmez.
--
-- Idempotent (IF NOT EXISTS + replace): kısmen uygulanmış ortamda yeniden koşturulabilir.
-- replace() ikinci kez koşarsa '"kongre"' artık bulunmaz → no-op.

-- (1) Etkinlik türü + TTB akredite etkinlik kodu
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL DEFAULT 'kongre';
ALTER TABLE "MedicalCongress" ADD COLUMN IF NOT EXISTS "ttbCode" TEXT;

CREATE INDEX IF NOT EXISTS "MedicalCongress_eventType_startDate_idx"
  ON "MedicalCongress"("eventType", "startDate");

-- (2) Modül anahtarı göçü: akış tercihlerinde "kongre" → "etkinlik"
UPDATE "Doctor"
   SET "feedModules" = replace("feedModules", '"kongre"', '"etkinlik"')
 WHERE "feedModules" LIKE '%"kongre"%';

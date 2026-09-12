// KVKK/açık onam — db importsuz sabitler (proxy'den de kullanılabilir; Node runtime).
// CONSENT_VERSION: onam aydınlatma/rıza metni esaslı değişince ARTIR → kullanıcılar bir kez
// yeniden onaylar (eski sürümle onaylamış olanların JWT'sindeki cv < yeni sürüm → /onam).
export const CONSENT_SCOPE = "GENERAL_KVKK";

// v2: onam kaydı artık ispat & bütünlük katmanı taşıyor (metin hash'i + cihaz + hash-zinciri + zaman damgası).
// Materyal değişiklik → herkes bir kez yeniden onaylar; yeni kayıtlar tam proof alanlarıyla mühürlenir.
// v3 (2026-07-16, kullanıcı/hukukçu onaylı): 6. maddedeki "(crypto-shred)" vaadi KALDIRILDI —
// mimari hasta-bazında anahtar imhası yapamıyor (DEK alanın içinde; [[kvkk-account-deletion]]) ve
// /guven-ve-gizlilik zaten dürüstçe tersini açıklıyordu. Yeni metin kodun GERÇEKTE yaptığını söyler:
// kişisel veri silinir; yasal saklamaya tabi klinik kayıt erişime kapanır + süre sonunda fiziken imha
// (lib/account-deletion.ts iki-katman + RETENTION_YEARS cron). Sürüm artışı = herkes bir kez yeniden onaylar.
// v4 (2026-09-13, kod Paket B — AURA hukuki set Sürüm 1.0 NİHAİ, 👤 12.09.2026): EKRAN = HASH. Kanonik metin artık
// belge A01'in tam yayın kesitidir (lib/aura-legal/texts/aydinlatma — TR kanonik + EN ikinci kanonik, hash dil başına);
// /onam hasta kapısı A01 + A02 (AURA_TERMS v1) tam metnini gösterir, özet madde/taslak dönemi kapandı. Personel artık
// GENERAL_KVKK değil STAFF_KVKK (A09 + rol kesiti) onaylar (lib/doctorium-consent requiredConsentScopes). Bu artış
// hasta + personel + Aşama 2 doktoru bir kez yeniden onaya düşürür (proxy cv < 4 → /onam).
export const CONSENT_VERSION = 4;

// v3 TARİHÎ metin (2026-07-16 – 2026-09-13) — yalnız referans: v4'ten itibaren GENERAL_KVKK kaydına A01 yayın kesiti
// hash'lenir (lib/consent.ts recordConsent varsayılanı GENERAL_KVKK_TEXT.tr). Eski v3 kayıtlarının hash'i bu metne aittir;
// kanıt sayfasında "metin eşleşmesi" yalnız güncel sürümde ölçüldüğünden bu sabit artık hiçbir yeni kaydın kaynağı DEĞİLDİR.
// Proxy bu modülü import eder → uzun A01 metni BURAYA konmaz (edge/proxy bundle'ı küçük kalsın).
export const CONSENT_TEXT = `AURA Telesağlık — KVKK Aydınlatma ve Açık Rıza Metni (Sürüm 3 · TASLAK)

1. Veri Sorumlusu: AURA platformunu işleten şirket(ler) (S1 Yazılım / S2 Operasyon).
2. İşlenen veriler: kimlik ve iletişim bilgileriniz; sağlık verileriniz (özel nitelikli) — şikayet, tıbbi belgeler, görüşme ve takip kayıtları.
3. Amaç: triyaj, doktor eşleştirme, teletıp görüşmesi, tedavi/paket ve post-op takip hizmetlerinin sunulması.
4. Yapay zeka işleme: açık rızanızla, belirli verileriniz (triyaj semptomu, yüklenen belgeler, görüşme notu, tercüme sesi) hizmet kalitesi için yapay zeka sağlayıcılarınca işlenir (ayrı kova/onam — DPA/SCC güvenceleriyle).
5. Aktarım: gerekiyorsa veriler vatandaşı olduğunuz ülkede veya uygun güvenceyle yurt dışında işlenebilir.
6. Haklarınız: KVKK m.11 ve GDPR kapsamındaki erişim, düzeltme, silme ve itiraz haklarınızı kullanabilirsiniz. Silme talebinizde kişisel verileriniz silinir; mevzuat gereği saklanması zorunlu klinik kayıtlar erişime kapatılır ve yasal saklama süresi sonunda fiziken imha edilir.
7. Açık rıza: yukarıdaki kapsamda özel nitelikli sağlık verilerimin işlenmesine açık rıza gösteriyorum.`;

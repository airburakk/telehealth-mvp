// KVKK/açık onam — db importsuz sabitler (proxy'den de kullanılabilir; Node runtime).
// CONSENT_VERSION: onam aydınlatma/rıza metni esaslı değişince ARTIR → kullanıcılar bir kez
// yeniden onaylar (eski sürümle onaylamış olanların JWT'sindeki cv < yeni sürüm → /onam).
export const CONSENT_SCOPE = "GENERAL_KVKK";

// v2: onam kaydı artık ispat & bütünlük katmanı taşıyor (metin hash'i + cihaz + hash-zinciri + zaman damgası).
// Materyal değişiklik → herkes bir kez yeniden onaylar; yeni kayıtlar tam proof alanlarıyla mühürlenir.
export const CONSENT_VERSION = 2;

// Onaylanan kanonik (TR) aydınlatma + açık rıza metni. ⚖️ TASLAK — nihai hukuki metin veri sorumlusu +
// hukuk müşaviri tarafından verilecek. Bu metnin SHA-256 hash'i her onam kaydına "textHash" olarak mühürlenir
// (RFC 3161 zaman damgasıyla birlikte → hangi metnin hangi sürümünü onayladığı ispatlanabilir). Metin değişince
// CONSENT_VERSION artır → hash değişir → toplu yeniden onam. Lokalize sunum ConsentGate'tedir; kanonik = bu TR metin.
export const CONSENT_TEXT = `AURA Telesağlık — KVKK Aydınlatma ve Açık Rıza Metni (Sürüm 2 · TASLAK)

1. Veri Sorumlusu: AURA platformunu işleten şirket(ler) (S1 Yazılım / S2 Operasyon).
2. İşlenen veriler: kimlik ve iletişim bilgileriniz; sağlık verileriniz (özel nitelikli) — şikayet, tıbbi belgeler, görüşme ve takip kayıtları.
3. Amaç: triyaj, doktor eşleştirme, teletıp görüşmesi, tedavi/paket ve post-op takip hizmetlerinin sunulması.
4. Yapay zeka işleme: açık rızanızla, belirli verileriniz (triyaj semptomu, yüklenen belgeler, görüşme notu, tercüme sesi) hizmet kalitesi için yapay zeka sağlayıcılarınca işlenir (ayrı kova/onam — DPA/SCC güvenceleriyle).
5. Aktarım: gerekiyorsa veriler vatandaşı olduğunuz ülkede veya uygun güvenceyle yurt dışında işlenebilir.
6. Haklarınız: KVKK m.11 ve GDPR kapsamındaki erişim, düzeltme, silme (crypto-shred) ve itiraz haklarınızı kullanabilirsiniz.
7. Açık rıza: yukarıdaki kapsamda özel nitelikli sağlık verilerimin işlenmesine açık rıza gösteriyorum.`;

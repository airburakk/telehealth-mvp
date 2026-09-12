// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/aura-hukuki-belgeler/teslim/md/A01-kvkk-aydinlatma-metni-hasta.md (TR) + en/A01-privacy-notice-and-explicit-consent-patient.md (EN) — Sürüm 1.0 · 12.09.2026 NİHAİ.
// Elle DÜZENLEME YOK: kaynak .md vault'ta; `python -X utf8 _yayin-kesiti.py` yeniden üretir. Kimlik etiketleri tüzel kişilik kurulana dek
// yayın yer tutucusuyla geçer; e-posta kanalı kutu açılana dek yayımlanmaz (platform içi form). Belge A0N atıfları yayımlı rotalara bağlıdır.
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (çelişkide TR esastır). Aynı dizeler kod Paket B'de onam kaydına hash'lenir.
export const AYDINLATMA_TR = `## 1. Veri sorumlusu

| | |
|---|---|
| Unvan | **AURA platform işleticisi** *(tüzel kişilik kuruluşu tamamlandığında ticaret unvanı, adres, MERSİS/vergi numarası, KEP adresi ve VERBİS bilgisi bu bölüme eklenecektir)* |
| İletişim (KVKK başvurusu · güvenlik ihbarı · itiraz) | Platform içi başvuru formu: [/kvkk-basvuru](/kvkk-basvuru) *(e-posta kanalı açıldığında adres bu bölüme eklenecektir)* |
| Avrupa Birliği'ndeki hastalar için temsilci (GDPR madde 27) | *(lansmandan önce belirlenecek ve bu bölüme eklenecektir)* |

AURA telesağlık platformu ile Doctorium **aynı tüzel kişilik** tarafından işletilir; **tek veri sorumlusu** vardır. Sağlık Turizmi Acentesi ayrı bir tüzel kişilik olarak kurulursa, ona yapılan aktarım madde 7.1'de ayrı satırda gösterilir.

---

## 2. AURA nedir, hangi ilişki kapsamında veri işlenir

AURA; hastayı doğru uzmanlık alanındaki doktorla buluşturan, uzaktan görüşmeyi, ikinci görüşü, sağlık turizmi
planlamasını ve ameliyat sonrası takibi **koordine eden** çok dilli bir dijital sağlık platformudur. Dört başvuru
yolu vardır: **Doktorla görüşme** (ön değerlendirme + uzaktan konsültasyon), **İkinci Görüş** (mevcut tanı/tedavi
planı için yazılı uzman görüşü), **Sağlık Turizmi** (tedavi ve seyahat planlaması) ve **Ücretsiz Sağlık Hizmeti**
(gönüllü doktorlarla ücretsiz görüşme). Bunlara ameliyat sonrası takip, sağlık kayıtlarınızı üçüncü kişilerle
güvenli paylaşma ve Etik Kurul'a başvuru eşlik eder.

> **AURA tanı koymaz, tedavi vermez.** Tıbbi değerlendirme, tanı, tedavi ve reçete kararları **yetkili doktorlara**
> aittir; AURA bilgilerinizi düzenler, uygun uzmanlık alanını önerir, görüşmeyi ve süreci koordine eder. Yapay zekâ
> destekli hiçbir adım tıbbi karar üretmez.
> AURA **acil servis değildir**; hayati tehlike içeren durumda 112'yi (bulunduğunuz ülkenin acil numarasını) arayın
> (Belge A03 madde 4).

Platform **18 yaşını doldurmuş** kişilere açıktır.

---

## 3. İşlenen kişisel veriler

### 3.1 Hesap ve iletişim

| Kategori | Veriler |
|---|---|
| Kayıt | Ad-soyad, e-posta adresi, parolanızın **geri döndürülemez özeti** (parola açık hâliyle saklanmaz). Google veya Apple ile giriş yaparsanız sağlayıcıdan yalnız kimlik tanımlayıcısı ve e-posta alınır |
| Profil | Ülke, tercih ettiğiniz dil, cep telefonu *(şifreli)*, iletişim tercihi (uygulama içi · SMS · e-posta), sağlık geçmişi özeti *(şifreli; madde 3.2)* |
| Hesap güvenliği | E-posta doğrulama ve parola sıfırlama bağlantılarının özetleri (24 saat / 1 saat geçerli; kullanılınca silinir) |
| Yaş beyanı | Kayıtta 18 yaşını doldurduğunuza ilişkin doğum tarihi beyanı — **saklanmaz, kaydedilmez**; yalnız kapıda kontrol edilir |

### 3.2 Sağlık verileri — özel nitelikli kişisel veri

| Kategori | Veriler | Not |
|---|---|---|
| Ön değerlendirme (triyaj) | Şikâyetiniz, süresi, uzmanlık alanına özgü sorulara verdiğiniz yanıtlar, aciliyet derecesi ve önerilen uzmanlık alanı ile gerekçesi | Şikâyet ve gerekçe **şifreli** saklanır; yapay zekâ ile ön değerlendirme **ayrı açık rızanıza** bağlıdır (madde 10) |
| Sağlık geçmişi özeti | Kronik hastalıklar, düzenli ilaç, sigara, geçirilmiş büyük ameliyat | Profil hafızası; sonraki başvuruda ön-doldurur |
| Tıbbi belgeler | Yüklediğiniz rapor, tetkik, reçete, görüntüleme dosyaları (DICOM dâhil) | Depoya **yüklenmeden önce şifrelenir**; depolama sağlayıcısı yalnız şifreli hâli görür. DICOM dosyaları uzman havuzuna yalnız kimlik etiketleri temizlenerek ve görüntü içine işlenmiş yazılar maskelenerek çıkar |
| Uzaktan görüşme | Video ve ses **kaydedilmez**. Görüşme sırasında üretilen canlı altyazı/tercüme metni (transkript) ile doktorun görüşme notu (SOAP) **şifreli** saklanır | Simültane tercüme **ayrı açık rızanıza** bağlıdır (madde 10) |
| Klinik sonuçlar | Epikriz/özet rapor, laboratuvar sonuçları (LOINC), tanı kodu (ICD-10), önerilen işlemler | Şifreli |
| Ameliyat sonrası takip | Günlük kontrol yanıtları, notunuz, yüklediğiniz iyileşme fotoğrafları | Şifreli; takip bitince klinik personelin erişimi kapanır, kayıt yalnız size kalır |
| İkinci Görüş dosyası | Mevcut tanı/tedavi planınız, belgeleriniz, uzman görüşü | Şifreli; uzman havuzunda **anonim** önizleme |
| Sigorta sağlık beyanı | Kronik hastalık, düzenli ilaç, sigara, büyük ameliyat beyanı (yalnız sağlık turizmi paketinde) | Şifreli, başvuruya sabit; personel, doktor ve acente **ham beyanı görmez**, yalnız risk çarpanını görür. **Ayrı rıza** alınır (Belge A04-d) |
| Etik Kurul başvurusu | Şikâyet konusu, açıklama, delil, gerekçe | Şifreli; kurul **kimliğinizi görmez** |
| Ücretsiz Sağlık başvurusu | Hasta adı (siz veya yakınınız), ülke, şikâyet, süre | (!) Yakınınız adına başvuruyorsanız onun verisini **onun bilgisi ve rızasıyla** girmelisiniz; formdaki beyan kutusunu işaretlersiniz ([Belge A02](/kosullar) madde 3.4) |

### 3.3 Seyahat, paket ve rezervasyon verileri (sağlık turizmi kulvarı)

Tercih ettiğiniz tedavi tarihi aralığı, otel/tercüman/sigorta seviyesi tercihleri, hastane seçimi, tahmini
paket bedeli ve rezervasyon durumu. **Ödeme kartı veya banka bilgisi toplanmaz** — ödeme, emanet (escrow) ve
sigorta akışları bugün **simülasyondur**; gerçek tahsilat yapılmaz, poliçe düzenlenmez.

### 3.4 Onay ve rıza kayıtları

Her onay/rıza: kapsam, sürüm, onayladığınız metnin özeti (hash), tarih-saat, IP adresi ve tarayıcı bilgisi;
kayıtlar sonradan değiştirilemeyen zincirde tutulur ve zaman damgalanır. Kendi kaydınızı \`/onam/kanit\`
sayfasından görüntüleyebilirsiniz.

### 3.5 İşlem güvenliği

Giriş kayıtları, IP adresi, tarayıcı/cihaz bilgisi, sağlık kayıtlarınıza yapılan **her anlamlı erişimin** kaydı
(kim, ne zaman, hangi kayıt) — sonradan silinip değiştirilemeyen zincirde; siz de \`/erisim-kaydi\` sayfasından
görebilirsiniz.

### 3.6 Çerezler ve yerel depolama

→ *Çerez ve Yerel Depolama Politikası* ([Belge A05](/cerez)) (yalnız oturum ve görünüm çerezi; analitik/reklam çerezi yok).

### 3.7 İşlenmeyen veriler

- **Kimlik belgesi kopyası, T.C. kimlik numarası veya pasaport** istenmez *(isteğe bağlı bir kimlik tanımlayıcısı
  yalnız siz girerseniz ve yalnız klinik kayıt eşleştirmesi için işlenir)*.
- **Ödeme/banka bilgisi** toplanmaz (madde 3.3).
- **Konum verisi** (GPS) toplanmaz; yalnız beyan ettiğiniz ülke.
- **Biyometrik veri** işlenmez (video görüşmesi yüz tanıma amacıyla analiz edilmez).
- Genetik veri, ceza mahkûmiyeti, dernek/sendika/parti üyeliği, inanç bilgisi **istenmez**; siz serbest metne
  yazarsanız yalnız klinik bağlamıyla işlenir.

---

## 4. Kişisel verilerin işlenme amaçları

1. Hesabınızın oluşturulması, doğrulanması ve yönetilmesi; 18 yaş kontrolü
2. Şikâyetinizin **ön değerlendirmesi** ve uygun uzmanlık alanına yönlendirilmesi *(yapay zekâ destekli kısmı açık rızanıza bağlı)*
3. Doktor eşleştirmesi, randevu ve **uzaktan görüşmenin** yürütülmesi; doktorun görüşme notu ve raporu hazırlaması
4. Görüşmenin **simültane tercümesi** *(açık rızanıza bağlı)* ve belgelerinizin çevirisi
5. **İkinci Görüş** dosyanızın uzmana iletilmesi ve görüşün size sunulması
6. **Ücretsiz Sağlık Hizmeti** başvurunuzun gönüllü doktorla eşleştirilmesi
7. **Sağlık turizmi** planlaması: tedavi/paket önizlemesi, hastane ve seyahat koordinasyonu, sigorta risk değerlendirmesi *(sağlık beyanı ayrı rızanıza bağlı)*
8. **Ameliyat sonrası takip**: günlük kontrol, uyarı işaretlerinin doktora iletilmesi
9. Sağlık kayıtlarınızın **sizin talimatınızla** üçüncü kişilerle paylaşılması (bağlantı, süre, parola, kapsam sizin seçiminiz)
10. **Etik Kurul** başvurunuzun anonim incelenmesi
11. Bildirimlerin iletilmesi (uygulama içi · tarayıcı push · seçtiğiniz kanal)
12. Bilgi güvenliği, kötüye kullanımın önlenmesi, erişim denetimi, hukuki taleplere cevap ve mevzuattan doğan yükümlülükler
13. Hizmet kalitesinin **toplulaştırılmış, kimliksiz** ölçümü *(kişi bazlı analitik yapılmaz)*

---

## 5. Hukuki sebepler

### 5.1 KVKK (Türkiye)

| Amaç | Hukuki sebep |
|---|---|
| Hesap, doğrulama, güvenlik, bildirimler (1, 11, 12) | **m.5/2-c** sözleşmenin kurulması ve ifası · **m.5/2-ç** hukuki yükümlülük · **m.5/2-f** meşru menfaat (güvenlik) |
| Sağlık verilerinin işlenmesi (2, 3, 5, 6, 7, 8, 10) | **m.6 — açık rıza** (madde 14 beyanı). Doktorunuzun, sır saklama yükümlülüğü altında tıbbi teşhis, tedavi ve bakım hizmetinin yürütülmesi amacıyla yaptığı işleme ayrıca **m.6/3** kapsamındadır. Rızanızı geri almanız, hizmetin ifası sırasında oluşmuş klinik kaydın yasal saklama süresi boyunca **m.7** uyarınca erişime kapatılarak tutulmasını sona erdirmez (madde 8) |
| Yapay zekâ ile ön değerlendirme ve belge çevirisi (2, 4) | **m.6 — ayrı açık rıza** (\`AI_TRIAGE\`, Belge A04-b) |
| Simültane tercüme (4) | **m.6 — ayrı açık rıza** (\`AI_INTERPRET\`, Belge A04-c) |
| Sigorta sağlık beyanı (7) | **m.6 — ayrı açık rıza** (Belge A04-d) |
| Paylaşım bağlantısı (9) | Sizin talimatınız — **m.5/1 açık rıza** niteliğinde; bağlantıyı siz oluşturur ve iptal edersiniz |
| Yurt dışına aktarım (madde 7) | **m.9** — bugün açık rıza; işletici tüzel kişilik kurulunca sağlayıcı sözleşmeleri/taahhütname (Belge 18) |
| Kimliksiz kalite ölçümü (13) | Kişisel veri değildir (toplulaştırılmış) |

> **Rızanız özgürdür; ancak sağlık hizmetinin doğası gereği sağlık verinizi işlemeden görüşme, ikinci görüş veya takip
> sunulamaz.** Yapay zekâ ile ön değerlendirme başvurunun başlangıç adımıdır: bu rızayı vermezseniz başvuru oluşturulamaz
> ve hizmeti almamayı seçmiş olursunuz. Tercüme rızası yalnız görüşme dilleriniz farklıysa sorulur ve tercümesiz
> devam edebilirsiniz. Rızanızı sonradan geri alabilirsiniz — o ana kadar yapılan işleme hukuka uygun kalır.

### 5.2 GDPR (Avrupa Birliği'nde yerleşik hastalar)

Avrupa Birliği'nde yerleşik iseniz Genel Veri Koruma Tüzüğü de uygulanır: hesap ve hizmet işlemleri **madde 6/1-b**
(sözleşme) ve **6/1-f** (meşru menfaat — güvenlik); sağlık verileri **madde 9/2-a — açık rıza**; AB dışına aktarım
**madde 44 vd.** (madde 7.3: Avrupa Komisyonu standart sözleşme hükümleri — tüzel kişilikle imzalanacak sağlayıcı
sözleşmeleri). Haklarınız madde 9'da; şikâyet için kendi ülkenizin veri koruma otoritesine başvurabilirsiniz.

---

## 6. Toplama yöntemi

Veriler; kayıt ve profil formları, ön değerlendirme formu, belge yükleme, uzaktan görüşme (canlı altyazı/tercüme
akışı), doktorun girdiği notlar ve raporlar, günlük takip formları, paylaşım ve şikâyet ekranları, Google/Apple
giriş sağlayıcıları ve otomatik sistem kayıtları (giriş/erişim logları) yoluyla **elektronik ortamda** toplanır.
Doktorunuzun girdiği klinik kayıtlar (görüşme notu, epikriz, lab, tanı kodu) da sizin sağlık verinizdir.

---

## 7. Aktarım

### 7.1 Kimlere aktarılır (platform içi roller ve üçüncü kişiler)

| Alıcı | Ne görür | Sınır |
|---|---|---|
| **Size atanan doktor** (branş doktoru, nöbetçi/icapçı doktor, gönüllü doktor, ikinci görüş uzmanı) | Başvurunuzun klinik içeriği | Yalnız doğrulanmış ve **başvurunuza atanmış/kabul etmiş** doktor; erişim vaka bazlıdır ve zincire yazılır. Atanmadan önce uzman havuzunda **kimliksiz** önizleme (ad ve tanımlayıcılar maskelenir) |
| **Koordinatör** (operasyon) | Süreç, lojistik ve rezervasyon bilgileri | Klinik kayıt değil |
| **Sağlık Turizmi Acentesi** *(bugün platform içi rol; ayrı tüzel kişi olursa Belge A13)* | Ad, ülke, dil, telefon, iletişim tercihi, hastane, tedavi süresi aralığı, sigorta **risk çarpanı** | **Ham sağlık beyanı, tıbbi belge ve klinik kayıt GÖRMEZ** |
| **Partner Doktor** (yurt dışı yönlendiren) | Kendisine iletilen soru | Hasta veritabanına erişimi **yoktur**; kişi adları maskelenir |
| **Etik Kurul** | Başvurunuz ve anonim vaka özeti | **Kimliğinizi görmez** |
| **Paylaşım bağlantısı alıcıları** (sizin seçtiğiniz kişi/kurum) | Sizin seçtiğiniz kategoriler (epikriz · görüşme notu · lab · radyoloji) | Süre, parola ve indirme kısıtı sizin; her erişim kaydedilir; bağlantıyı istediğiniz an iptal edersiniz |
| **Hastane / sağlık tesisi** | *(bugün: yok — rezervasyon simülasyon)* | Gerçek rezervasyon başladığında bu satır güncellenir ve sürüm artar |
| **Sigorta şirketi** | *(bugün: yok — poliçe düzenlenmez)* | Aynı |
| Yetkili kamu kurum ve kuruluşları | Mevzuatın öngördüğü hâllerde ve ölçüde | — |

### 7.2 Hizmet sağlayıcılar (veri işleyenler)

Sunucu ve veritabanı altyapısı **Avrupa Birliği içinde** (Frankfurt) konumlandırılmıştır. Aşağıdaki sağlayıcılar
veri işleyen konumundadır:

| Sağlayıcı | Amaç | Aktarılan veri | Konum |
|---|---|---|---|
| Vercel | Barındırma, uygulama sunumu | Uygulama trafiği (geçişte), sunucu logları | İşlem AB (Frankfurt); şirket ABD |
| Neon | Veritabanı | Tüm kategoriler — sağlık verileri ve kimlik alanları **şifreli** | AB (Frankfurt); şirket ABD |
| Vercel Blob | Belge ve görüntü depolama | Tıbbi belgeler — **yüklenmeden önce şifreli**; sağlayıcı yalnız şifreli hâli görür | Sağlayıcı altyapısı |
| **Anthropic** (Claude) | Ön değerlendirme, görüşme notu özeti, epikriz, iyileşme fotoğrafı analizi, klinik ve belge çevirisi | Klinik içerik (şikâyet, belge metni, not) — **adınız gitmez** (yer tutucuyla değiştirilir); yalnız açık rızanızla | **ABD** |
| **Google** (Gemini Live) | Görüşmenin simültane tercümesi | Görüşme **sesi canlı akar**; oturum durumu saklanmaz; yalnız açık rızanızla | **ABD** |
| Ably | Görüşme sinyalleşmesi | Bağlantı kurulum mesajları — **sağlık verisi ve transkript gitmez** | Küresel |
| Cloudflare / Metered | Video röle (doğrudan bağlantı kurulamayınca) | Yalnız **şifreli** medya trafiği; içerik görülemez | Küresel |
| Google · Apple | Hesapla giriş (seçerseniz) | Kimlik tanımlayıcısı, e-posta | ABD |
| Upstash | Kötüye kullanım koruması (hız sınırlama) | IP adresi sayaçları — sağlık verisi yok | Sağlayıcı altyapısı |
| Tarayıcı push servisleri (Google, Apple, Mozilla) | Bildirim iletimi | Bildirim başlığı — **ad ve sağlık bilgisi gömülmez** | Küresel |
| **Resend** | E-posta gönderimi — e-posta doğrulama, parola kurtarma ve (e-posta kanalını seçtiyseniz) süreç bildirimleri | E-posta adresi ve ileti içeriği; iletilere **ad ve sağlık bilgisi gömülmez** | **ABD** |
| SMS sağlayıcısı | SMS bildirimi (kanalı seçtiyseniz) | *(bugün etkin değil; etkinleşince adı ve konumu bu tabloya eklenir)* | — |

### 7.3 Yurt dışına aktarım

Sağlayıcıların bir kısmı **ABD merkezli** tüzel kişilerdir; altyapının AB'de olması yurt dışı aktarım
değerlendirmesini tek başına ortadan kaldırmaz. AB dışına **fiilen çıkan** sınırlı durumlar: yapay zekâ işlemleri
(Anthropic, Google — yalnız açık rızanızla), e-posta gönderimi (Resend), video röle trafiği (şifreli), giriş sağlayıcıları ve push servisleri.
Aktarım dayanağı: KVKK **m.9** kapsamında bugün açık rızanız; işletici tüzel kişilik kurulunca sağlayıcılarla
imzalanacak yazılı taahhütname / standart sözleşme hükümleri (GDPR madde 46 standart sözleşme hükümleri dâhil) —
Belge 18.

---

## 8. Saklama süreleri

| Veri | Süre |
|---|---|
| Hesap ve profil verileri | Üyelik süresince; hesabınızı sildiğinizde **derhâl** silinir. Hiç başvuru açmamış ve üç yıl giriş yapılmamış hesap, 30 gün önce bildirim yapılarak silinir |
| **Klinik kayıtlar** (ön değerlendirme, belgeler, görüşme notu ve transkript, epikriz, lab, takip, ikinci görüş, şikâyet, rezervasyon) | Hesabınızı sildiğinizde **erişime kapatılır** — doktor, koordinatör, yönetici ve siz dâhil hiç kimse açamaz — ve silme anından itibaren **20 yıl** sonunda otomatik olarak imha edilir. Yurt dışında yerleşik hastalar için de Türk hukukundaki saklama süresi esas alınır |
| Paylaşım bağlantıları ve alıcı erişim kayıtları | Belirlediğiniz süre sonuna veya iptalinize kadar; hesap silmede tüm bağlantılar **iptal edilir** |
| Bildirimler, push abonelikleri | Hesap silmede derhâl silinir |
| Sigorta sağlık beyanı | Bağlı olduğu başvurunun klinik kaydıyla birlikte |
| Yaş beyanı (doğum tarihi) | **Saklanmaz** |
| E-posta doğrulama / parola sıfırlama bağlantısı özetleri | 24 saat / 1 saat; kullanılınca derhâl silinir |
| Onay ve rıza kayıtları | Bağlı olduğu klinik kaydın saklama süresi boyunca (ispat); klinik kayıt yoksa **10 yıl**. Hesap silmede IP ve cihaz bilgisi boşaltılır, kayıt kimliksiz doğrulama halkası olarak kalır |
| Erişim ve işlem güvenliği kayıtları | Zincir satırı silinmez; **2 yıl** sonunda IP ve cihaz alanları boşaltılır |
| KVKK başvuru kütüğü | **3 yıl** |
| Oturum çerezi | **7 gün** ([Belge A05](/cerez)) |

Bu tablo, *Saklama ve İmha Politikası (Telesağlık)* (Belge A06) madde 3 tablosunun özetidir; fark hâlinde o politika esastır.

---

## 9. Haklarınız

**KVKK m.11:** kişisel verinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işlenme amacını ve amaca uygun
kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, düzeltilmesini isteme, silinmesini veya yok
edilmesini isteme, düzeltme/silme işlemlerinin aktarıldığı kişilere bildirilmesini isteme, münhasıran otomatik
sistemlerle analiz sonucu aleyhinize bir sonuç doğmasına itiraz etme ve zararın giderilmesini talep etme.
**GDPR (AB'de yerleşik hastalar):** ayrıca işlemenin kısıtlanmasını isteme, **veri taşınabilirliği** (klinik
kayıtlarınızı FHIR standardında dışa aktarma imkânı platformda mevcuttur), rızayı geri alma ve denetim otoritesine
şikâyet hakları.

Başvuru kanalı ve usulü → *Veri Sahibi Başvuru Usul ve Esasları* ([Belge A07](/kvkk-basvuru)). Rızalarınızı \`/onam/kanit\` sayfasında
görebilir; hesabınızı ve kişisel verilerinizi **Hesabım** sayfasından doğrudan silebilirsiniz (iki katman: kişisel
veri gerçekten silinir, klinik kayıt erişime kapanır — madde 8).

---

## 10. Yapay zekâ ve otomatik işleme

**Ön değerlendirme:** yapay zekâ, şikâyetinizi yalnız **uygun uzmanlık alanını önermek ve aciliyeti sıralamak**
için analiz eder; tanı, tedavi veya tıbbi karar üretmez. Uzmanlık önerisi doktor ve operasyon tarafından
değiştirilebilir. **Simültane tercüme:** görüşme sesi canlı çevrilir; kayıt tutulmaz. **Görüşme notu ve epikriz:**
yapay zekâ taslak hazırlar, **doktor onaylar ve sorumluluk doktorundur**. **İyileşme fotoğrafı:** yapay zekâ olası
uyarı işaretlerini doktora iletir; karar doktorundur. Bu işlemlerin hiçbiri hakkınızda **hukuki sonuç doğuran veya
sizi önemli ölçüde etkileyen otomatik bir karar** oluşturmaz (KVKK m.11/g · GDPR madde 22): hizmete erişim
otomatik olarak reddedilmez, fiyat kişisel verinize göre otomatik belirlenmez *(sağlık turizmi paketinde sigorta
risk çarpanı sizin beyanınızdan hesaplanır ve tahminidir; bağlayıcı bedeli sigorta şirketi belirler)*.

Her yapay zekâ adımı **ayrı açık rızaya** bağlıdır; rıza vermeden adım başlamaz (form açılmaz, mikrofon izni
istenmez). Metinler: Belge A04.

---

## 11. Görüntü ve ses

Uzaktan görüşmeler **kaydedilmez**. Video ve ses tarayıcıdan tarayıcıya şifreli aktarılır; doğrudan bağlantı
kurulamadığında devreye giren röle sunucusu yalnız şifreli trafiği taşır. Simültane tercüme açıksa görüşme sesi
tercüme sağlayıcısına **canlı** akar ve oturum durumu saklanmaz; üretilen altyazı/tercüme metni klinik kaydınızın
parçası olarak şifreli tutulur.

---

## 12. Çocuklar

Platform 18 yaşını doldurmamış kişilere hizmet vermez; kayıtta doğum tarihi beyanı alınır ve saklanmaz. 18 yaşından
küçük bir hastanın tedavisi için yasal temsilcisinin kendi adına başvurması **kabul edilmez**. Ücretsiz Sağlık Hizmeti başvurusunda yakınınız adına bilgi giriyorsanız, onun bilgisi ve rızasını
aldığınızı (reşit değilse yasal temsilcisi olduğunuzu) beyan eden kutu işaretlenmeden başvuru gönderilemez.

---

## 13. Değişiklikler

Bu metin, işleme faaliyetlerinde esaslı değişiklik olması hâlinde güncellenir. Esaslı değişiklikte sürüm numarası
artırılır ve **yeniden onayınız** alınır; önceki onaylar, verildikleri metnin özeti (hash) ile birlikte kayıt
zincirinde saklanmaya devam eder. Türkçe metin bağlayıcıdır; İngilizce çeviri ikinci kanonik metindir, diğer
dillerdeki sunumlar bilgilendirme amaçlıdır.

---

## 14. Açık rıza beyanı (ekranda ayrı kutu)

> Yukarıdaki aydınlatma metnini okudum ve anladım. **Sağlık verilerim dâhil özel nitelikli kişisel verilerimin**,
> madde 4'te sayılan amaçlarla AURA tarafından işlenmesine; madde 7'de belirtilen doktorlara, platform rollerine
> ve hizmet sağlayıcılara aktarılmasına; bu kapsamda **yurt dışına aktarılmasına** açık rızam vardır. Yapay zekâ ile
> ön değerlendirme, simültane tercüme ve sigorta sağlık beyanı için ayrı rıza isteneceğini biliyorum. Rızamı
> dilediğim zaman geri alabileceğimi biliyorum.

*(Bu beyan, onayladığınız metnin parçasıdır; onay düğmesi kutu işaretlenmeden etkinleşmez.)*
`;

export const AYDINLATMA_EN = `## 1. Data controller

| | |
|---|---|
| Legal name | **the AURA platform operator** *(when the incorporation of the legal entity is completed, the legal name, address, MERSİS/tax number, KEP address and VERBİS information will be added to this section)* |
| Contact (data subject requests · security reports · objections) | In-platform request form: [/kvkk-basvuru](/kvkk-basvuru) *(the e-mail channel will be added to this section when the mailbox is opened)* |
| Representative for patients in the European Union (GDPR Article 27) | *(to be designated before launch and added to this section)* |

The AURA telehealth platform and Doctorium are operated by the **same legal entity**; there is a **single data controller**. If the Health Tourism Agency is incorporated as a separate legal entity, transfers to it will be shown in a separate row in Section 7.1.

---

## 2. What AURA is and in which relationship your data is processed

AURA is a multilingual digital health platform that connects the patient with a doctor in the appropriate specialty and **coordinates** remote consultation, second opinion, health tourism planning and post-operative follow-up. There are four ways to begin: **Talk to a doctor** (preliminary assessment + remote consultation), **Second Opinion** (a written specialist opinion on an existing diagnosis/treatment plan), **Health Tourism** (treatment and travel planning) and **Free Care** (free consultation with volunteer doctors). These are accompanied by post-operative follow-up, secure sharing of your health records with third parties, and applications to the Ethics Board.

> **AURA does not diagnose or treat.** Medical assessment, diagnosis, treatment and prescription decisions belong to **licensed doctors**; AURA organises your information, suggests the appropriate specialty and coordinates the consultation and the process. No AI-assisted step produces a medical decision.
> AURA **is not an emergency service**; in a life-threatening situation call 112 (or the emergency number of the country you are in) (Document A03, Section 4).

The Platform is open to persons who are **18 years of age or older**.

---

## 3. Personal data processed

### 3.1 Account and contact

| Category | Data |
|---|---|
| Registration | Full name, e-mail address, an **irreversible digest** of your password (the password itself is never stored). If you sign in with Google or Apple, only the identity identifier and e-mail are obtained from the provider |
| Profile | Country, preferred language, mobile phone *(encrypted)*, contact preference (in-app · SMS · e-mail), health history summary *(encrypted; Section 3.2)* |
| Account security | Digests of e-mail verification and password reset links (valid 24 hours / 1 hour; deleted once used) |
| Age declaration | Your declaration of date of birth at registration confirming that you are 18 or older — **not stored, not recorded**; checked only at the gate |

### 3.2 Health data — special categories of personal data

| Category | Data | Note |
|---|---|---|
| Preliminary assessment (triage) | Your complaint, its duration, your answers to specialty-specific questions, urgency level, and the suggested specialty with its rationale | The complaint and rationale are stored **encrypted**; AI-assisted preliminary assessment is subject to your **separate explicit consent** (Section 10) |
| Health history summary | Chronic conditions, regular medication, smoking, previous major surgery | Profile memory; pre-fills your next case |
| Medical documents | Reports, test results, prescriptions and imaging files you upload (including DICOM) | **Encrypted before upload** to storage; the storage provider sees only the encrypted form. DICOM files reach the specialist pool only after identifying tags are removed and text burned into the image is masked |
| Remote consultation | Video and audio are **not recorded**. The live caption/translation text (transcript) generated during the consultation and the doctor's consultation note (SOAP) are stored **encrypted** | Simultaneous interpretation is subject to your **separate explicit consent** (Section 10) |
| Clinical results | Discharge summary/report, laboratory results (LOINC), diagnosis code (ICD-10), recommended procedures | Encrypted |
| Post-operative follow-up | Daily check-in answers, your note, recovery photos you upload | Encrypted; when follow-up ends, clinical staff access closes and the record remains with you only |
| Second Opinion file | Your existing diagnosis/treatment plan, your documents, the specialist opinion | Encrypted; **anonymous** preview in the specialist pool |
| Insurance health declaration | Declaration of chronic condition, regular medication, smoking, major surgery (health tourism package only) | Encrypted, fixed to the case; staff, doctors and the agency **do not see the raw declaration**, only the risk multiplier. **Separate consent** is obtained (Document A04-d) |
| Ethics Board application | Subject of complaint, description, evidence, rationale | Encrypted; the Board **does not see your identity** |
| Free Care application | Patient name (you or a relative), country, complaint, duration | (!) If you apply on behalf of a relative, you must enter their data **with their knowledge and consent** and tick the declaration box on the form ([Document A02](/kosullar), Section 3.4) |

### 3.3 Travel, package and booking data (health tourism track)

Your preferred treatment date range, hotel/interpreter/insurance level preferences, hospital choice, estimated package price and booking status. **No payment card or bank details are collected** — payment, escrow and insurance flows are currently a **simulation**; no actual charges are taken and no policy is issued.

### 3.4 Consent records

Every approval/consent: scope, version, digest (hash) of the text you approved, date-time, IP address and browser information; the records are kept in a tamper-evident chain and time-stamped. You can view your own record at \`/onam/kanit\`.

### 3.5 Transaction security

Login records, IP address, browser/device information, and a record of **every meaningful access** to your health records (who, when, which record) — in a chain that cannot be deleted or altered afterwards; you can see it at \`/erisim-kaydi\`.

### 3.6 Cookies and local storage

→ *Cookie and Local Storage Policy* ([Document A05](/cerez)) (session and appearance cookies only; no analytics/advertising cookies).

### 3.7 Data that is not processed

- **Copies of identity documents, Turkish ID number or passport** are not requested *(an optional identifier is processed only if you enter it yourself and only for matching clinical records)*.
- **Payment/bank details** are not collected (Section 3.3).
- **Location data** (GPS) is not collected; only the country you declare.
- **Biometric data** is not processed (video consultations are not analysed for face recognition).
- Genetic data, criminal convictions, membership of associations/unions/political parties and beliefs are **not requested**; if you write them in free text, they are processed only in their clinical context.

---

## 4. Purposes of processing

1. Creating, verifying and managing your account; age (18+) check
2. **Preliminary assessment** of your complaint and routing to the appropriate specialty *(the AI-assisted part is subject to your explicit consent)*
3. Doctor matching, appointments and conducting the **remote consultation**; preparation of the doctor's consultation note and report
4. **Simultaneous interpretation** of the consultation *(subject to your explicit consent)* and translation of your documents
5. Forwarding your **Second Opinion** file to the specialist and presenting the opinion to you
6. Matching your **Free Care** application with a volunteer doctor
7. **Health tourism** planning: treatment/package preview, hospital and travel coordination, insurance risk assessment *(the health declaration is subject to your separate consent)*
8. **Post-operative follow-up**: daily check-ins, forwarding warning signs to the doctor
9. Sharing your health records with third parties **on your instruction** (link, duration, password and scope are your choice)
10. Anonymous review of your **Ethics Board** application
11. Delivery of notifications (in-app · browser push · the channel you choose)
12. Information security, prevention of misuse, access control, responding to legal requests and fulfilling statutory obligations
13. **Aggregated, de-identified** measurement of service quality *(no person-level analytics)*

---

## 5. Legal bases

### 5.1 KVKK (Türkiye — Personal Data Protection Law No. 6698)

| Purpose | Legal basis |
|---|---|
| Account, verification, security, notifications (1, 11, 12) | **Article 5(2)(c)** conclusion and performance of a contract · **Article 5(2)(ç)** legal obligation · **Article 5(2)(f)** legitimate interest (security) |
| Processing of health data (2, 3, 5, 6, 7, 8, 10) | **Article 6 — explicit consent** (declaration in Section 14). Processing carried out by your doctor, under a duty of confidentiality, for the purposes of medical diagnosis, treatment and care services additionally falls under **Article 6(3)**. Withdrawing your consent does not end the retention of clinical records created during the performance of the service, which are kept with access closed for the statutory retention period under **Article 7** (Section 8) |
| AI-assisted preliminary assessment and document translation (2, 4) | **Article 6 — separate explicit consent** (\`AI_TRIAGE\`, Document A04-b) |
| Simultaneous interpretation (4) | **Article 6 — separate explicit consent** (\`AI_INTERPRET\`, Document A04-c) |
| Insurance health declaration (7) | **Article 6 — separate explicit consent** (Document A04-d) |
| Sharing link (9) | Your instruction — in the nature of **explicit consent under Article 5(1)**; you create and revoke the link |
| Transfers abroad (Section 7) | **Article 9** — currently your explicit consent; once the operating legal entity is incorporated, provider agreements/undertakings (Document 18) |
| De-identified quality measurement (13) | Not personal data (aggregated) |

> **Your consent is freely given; however, by the nature of a health service, no consultation, second opinion or follow-up can be provided without processing your health data.** AI-assisted preliminary assessment is the first step of a case: if you do not give this consent, a case cannot be created and you will have chosen not to receive the service. Consent for interpretation is asked only if the languages of the consultation differ, and you may continue without interpretation. You may withdraw your consent later — processing carried out until then remains lawful.

### 5.2 GDPR (patients resident in the European Union)

If you are resident in the European Union, the General Data Protection Regulation also applies: account and service operations under **Article 6(1)(b)** (contract) and **6(1)(f)** (legitimate interest — security); health data under **Article 9(2)(a) — explicit consent**; transfers outside the EU under **Article 44 et seq.** (Section 7.3: European Commission standard contractual clauses — provider agreements to be signed by the legal entity). Your rights are set out in Section 9; you may lodge a complaint with the data protection authority of your own country.

---

## 6. Method of collection

Data is collected **electronically** through registration and profile forms, the preliminary assessment form, document uploads, remote consultations (live caption/translation stream), notes and reports entered by the doctor, daily follow-up forms, sharing and complaint screens, Google/Apple sign-in providers and automatic system records (login/access logs). Clinical records entered by your doctor (consultation note, discharge summary, laboratory results, diagnosis code) are also your health data.

---

## 7. Transfers

### 7.1 Recipients (platform roles and third parties)

| Recipient | What they see | Limit |
|---|---|---|
| **The doctor assigned to you** (specialty doctor, on-duty/on-call doctor, volunteer doctor, second-opinion specialist) | The clinical content of your case | Only a verified doctor who has been **assigned to or has accepted your case**; access is case-based and written to the chain. Before assignment, a **de-identified** preview in the specialist pool (name and identifiers masked) |
| **Coordinator** (operations) | Process, logistics and booking information | Not the clinical record |
| **Health Tourism Agency** *(currently an in-platform role; Document A13 if it becomes a separate legal entity)* | Name, country, language, phone, contact preference, hospital, treatment duration range, insurance **risk multiplier** | **Does NOT see the raw health declaration, medical documents or clinical record** |
| **Partner Doctor** (referring doctor abroad) | The question forwarded to them | **No** access to the patient database; personal names are masked |
| **Ethics Board** | Your application and an anonymous case summary | **Does not see your identity** |
| **Recipients of sharing links** (persons/institutions you choose) | The categories you choose (discharge summary · consultation note · laboratory · radiology) | Duration, password and download restriction are yours; every access is recorded; you may revoke the link at any time |
| **Hospital / health facility** | *(currently: none — bookings are simulated)* | This row will be updated and the version increased when real bookings begin |
| **Insurance company** | *(currently: none — no policy is issued)* | Same |
| Authorised public institutions and bodies | Where and to the extent required by law | — |

### 7.2 Service providers (data processors)

Server and database infrastructure is located **within the European Union** (Frankfurt). The following providers act as data processors:

| Provider | Purpose | Data transferred | Location |
|---|---|---|---|
| Vercel | Hosting, application delivery | Application traffic (in transit), server logs | Processing in the EU (Frankfurt); company in the USA |
| Neon | Database | All categories — health data and identity fields **encrypted** | EU (Frankfurt); company in the USA |
| Vercel Blob | Document and image storage | Medical documents — **encrypted before upload**; the provider sees only the encrypted form | Provider infrastructure |
| **Anthropic** (Claude) | Preliminary assessment, consultation note summary, discharge summary, recovery photo analysis, clinical and document translation | Clinical content (complaint, document text, notes) — **your name is not sent** (replaced with a placeholder); only with your explicit consent | **USA** |
| **Google** (Gemini Live) | Simultaneous interpretation of the consultation | Consultation **audio streams live**; no session state is retained; only with your explicit consent | **USA** |
| Ably | Consultation signalling | Connection set-up messages — **no health data or transcript is sent** | Global |
| Cloudflare / Metered | Video relay (when a direct connection cannot be established) | Only **encrypted** media traffic; content cannot be viewed | Global |
| Google · Apple | Sign-in with account (if you choose) | Identity identifier, e-mail | USA |
| Upstash | Abuse protection (rate limiting) | IP address counters — no health data | Provider infrastructure |
| Browser push services (Google, Apple, Mozilla) | Notification delivery | Notification title — **no name or health information embedded** | Global |
| **Resend** | E-mail delivery — e-mail verification, password recovery and (if you chose the e-mail channel) process notifications | E-mail address and message content; **no name or health information is embedded** in messages | **USA** |
| SMS provider | SMS notifications (if you chose the channel) | *(not active today; name and location will be added to this table when activated)* | — |

### 7.3 Transfers abroad

Some providers are legal entities **headquartered in the USA**; the fact that the infrastructure is in the EU does not by itself remove the transfer-abroad assessment. Limited cases in which data **actually leaves** the EU: AI processing (Anthropic, Google — only with your explicit consent), e-mail delivery (Resend), video relay traffic (encrypted), sign-in providers and push services. Legal basis for transfer: currently your explicit consent under KVKK **Article 9**; once the operating legal entity is incorporated, written undertakings / standard contractual clauses to be signed with providers (including the GDPR Article 46 standard contractual clauses) — Document 18.

---

## 8. Retention periods

| Data | Period |
|---|---|
| Account and profile data | For the duration of membership; deleted **immediately** when you delete your account. An account that has never opened a case and has not been logged into for three years is deleted after notice 30 days in advance |
| **Clinical records** (preliminary assessment, documents, consultation note and transcript, discharge summary, laboratory, follow-up, second opinion, complaint, booking) | When you delete your account, **access is closed** — no one, including doctors, coordinators, administrators and yourself, can open them — and they are automatically destroyed **20 years** after the moment of deletion. The retention period under Turkish law also applies to patients resident abroad |
| Sharing links and recipient access records | Until the expiry you set or your revocation; all links are **revoked** on account deletion |
| Notifications, push subscriptions | Deleted immediately on account deletion |
| Insurance health declaration | Together with the clinical record of the case it belongs to |
| Age declaration (date of birth) | **Not stored** |
| E-mail verification / password reset link digests | 24 hours / 1 hour; deleted immediately once used |
| Consent records | For the retention period of the clinical record they relate to (proof); **10 years** if there is no clinical record. On account deletion, IP and device information are cleared and the record remains as a de-identified verification link |
| Access and transaction security records | Chain rows are not deleted; IP and device fields are cleared after **2 years** |
| Data subject request register | **3 years** |
| Session cookie | **7 days** ([Document A05](/cerez)) |

This table summarises the Section 3 table of the *Retention and Destruction Policy (Telehealth)* (Document A06); in case of difference, that policy prevails.

---

## 9. Your rights

**KVKK Article 11:** to learn whether your personal data is processed, to request information, to learn the purpose of processing and whether it is used in line with that purpose, to know the third parties to whom it is transferred, to request rectification, to request erasure or destruction, to request that rectification/erasure be notified to recipients, to object to a result arising against you from analysis exclusively by automated systems, and to claim compensation for damage.
**GDPR (patients resident in the EU):** additionally the rights to restriction of processing, **data portability** (the Platform offers export of your clinical records in the FHIR standard), withdrawal of consent, and complaint to a supervisory authority.

Channel and procedure → *Data Subject Request Procedure* ([Document A07](/kvkk-basvuru)). You can view your consents at \`/onam/kanit\`; you can delete your account and personal data directly from the **My Account** page (two layers: personal data is actually deleted, clinical records are closed to access — Section 8).

---

## 10. Artificial intelligence and automated processing

**Preliminary assessment:** the AI analyses your complaint only to **suggest the appropriate specialty and rank urgency**; it does not produce a diagnosis, treatment or medical decision. The specialty suggestion can be changed by the doctor and operations. **Simultaneous interpretation:** the consultation audio is translated live; no recording is kept. **Consultation note and discharge summary:** the AI prepares a draft, **the doctor approves it and the responsibility is the doctor's**. **Recovery photo:** the AI forwards possible warning signs to the doctor; the decision is the doctor's. None of these operations produces an **automated decision with legal effect or similarly significant effect** on you (KVKK Article 11(g) · GDPR Article 22): access to the service is not automatically refused, and no price is set automatically on the basis of your personal data *(in the health tourism package the insurance risk multiplier is calculated from your own declaration and is an estimate; the binding premium is set by the insurance company)*.

Each AI step is subject to **separate explicit consent**; no step starts without consent (the form does not open, no microphone permission is requested). Texts: Document A04.

---

## 11. Video and audio

Remote consultations are **not recorded**. Video and audio are transmitted encrypted from browser to browser; the relay server that takes over when a direct connection cannot be established carries only encrypted traffic. If simultaneous interpretation is on, the consultation audio streams **live** to the interpretation provider and no session state is retained; the generated caption/translation text is kept encrypted as part of your clinical record.

---

## 12. Children

The Platform does not provide services to persons under 18; a declaration of date of birth is taken at registration and is not stored. A legal representative applying in their own name for the treatment of a patient under 18 is **not accepted**. If you enter information on behalf of a relative in a Free Care application, the application cannot be submitted unless the box declaring that you have obtained their knowledge and consent (and that you are their legal representative if they are a minor) is ticked.

---

## 13. Changes

This notice is updated when there is a material change in processing activities. In the event of a material change the version number is increased and **your renewed consent** is obtained; earlier consents continue to be kept in the record chain together with the digest (hash) of the text to which they were given. The Turkish text is binding; the English translation is the second canonical text, and presentations in other languages are for information only.

---

## 14. Explicit consent declaration (separate checkbox on screen)

> I have read and understood the privacy notice above. I give my explicit consent to the processing by AURA of **my special categories of personal data, including my health data**, for the purposes listed in Section 4; to their transfer to the doctors, platform roles and service providers set out in Section 7; and, within that scope, to their **transfer abroad**. I know that separate consent will be requested for AI-assisted preliminary assessment, simultaneous interpretation and the insurance health declaration. I know that I may withdraw my consent at any time.

*(This declaration is part of the text you approve; the approval button is enabled only when the box is ticked.)*
`;

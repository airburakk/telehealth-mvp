// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/aura-hukuki-belgeler A02-kullanim-kosullari-hizmet-sozlesmesi-hasta.md + A02-terms-of-use-and-service-agreement-patient.md (teslim/md TR · en/ EN) — Sürüm 1.0 · 12.09.2026 NİHAİ.
// Elle DÜZENLEME YOK: kaynak .md vault'ta; `python -X utf8 _yayin-kesiti.py` yeniden üretir. Kimlik etiketleri tüzel kişilik kurulana dek
// yayın yer tutucusuyla geçer; e-posta kanalı kutu açılana dek yayımlanmaz (platform içi form). Belge A0N atıfları yayımlı rotalara bağlıdır.
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (çelişkide TR esastır). Aynı dizeler onam kaydına hash'lenir (ekran = hash, dil başına).
export const KOSULLAR_TR = `## 1. TARAFLAR VE KONU

**1.1.** İşbu sözleşme, **AURA platform işleticisi** ("**Platform**" veya "**AURA**") ile AURA telesağlık platformuna hasta
olarak kayıt olan gerçek kişi ("**Kullanıcı**") arasında, Platform'un sunduğu koordinasyon ve iletişim hizmetlerinin
kullanım koşullarını düzenler.

**1.2.** Kullanıcı, kayıt sırasında bu sözleşmeyi onaylamakla hükümlerini kabul etmiş sayılır. Onay kaydı, onaylanan
metnin özeti (hash), tarih-saat ve cihaz bilgisiyle birlikte değiştirilemeyen kayıt zincirine yazılır.

**1.3.** Platform ve Kullanıcı, işbu sözleşmede bundan böyle ayrı ayrı "**Taraf**" ve birlikte "**Taraflar**" olarak
anılacaktır.

**1.4.** Kişisel verilerin işlenmesine ilişkin aydınlatma **[Belge A01](/aydinlatma)**'de, tele-sağlık hizmetine ilişkin bilgilendirme
**Belge A03**'te yer alır; ikisi de bu sözleşmenin ayrılmaz parçasıdır.

---

## 2. TANIMLAR

| Terim | Anlam |
|---|---|
| **Doktor** | Mesleki kimliği doğrulanmış (e-Devlet barkodlu diploma) ve Platform yönetimince klinik aktivasyonu onaylanmış, Kullanıcı'ya atanan veya Kullanıcı'nın başvurusunu kabul eden doktor |
| **Klinik Hizmet Sağlayıcı** | Uzaktan sağlık hizmetini fiilen sunan, ilgili mevzuata göre yetkilendirilmiş sağlık tesisi veya doktor: *(yetki belgesi alındığında sağlayıcı kimliği bu bölüme eklenecektir)* |
| **Başvuru** | Kullanıcı'nın Platform'da açtığı ve bir uzmanlık alanına yönlendirilen dosya (ön değerlendirme, belgeler, görüşme ve takip kayıtlarıyla birlikte) |
| **Ön Değerlendirme** | Şikâyetin uygun uzmanlık alanına ve aciliyet sırasına yönlendirilmesi; yapay zekâ desteği yalnız açık rızayla |
| **Uzaktan Görüşme** | Doktor ile Kullanıcı arasında Platform üzerinden yapılan görüntülü/sesli görüşme |
| **İkinci Görüş** | Mevcut tanı veya tedavi planı hakkında, belgeler üzerinden yazılı uzman görüşü; isteğe bağlı görüntülü görüşme |
| **Ücretsiz Sağlık Hizmeti** | Maddi imkânı kısıtlı Kullanıcılar için gönüllü doktorlarla ücretsiz uzaktan görüşme |
| **Sağlık Turizmi Planlaması** | Tedavi, seyahat ve konaklamanın Platform üzerinden **önizlenmesi ve koordinasyonu** (Belge A08) |
| **Ameliyat Sonrası Takip** | Tedavi sonrası günlük kontrol ve doktor izlemi |
| **Paylaşım Bağlantısı** | Kullanıcı'nın seçtiği sağlık kayıtlarını üçüncü kişiye süreli, şifreli ve iptal edilebilir biçimde açan bağlantı |
| **Etik Kurul** | Platform içi bağımsız inceleme organı; başvuruları anonim inceler |
| **Klinik Kayıt** | Ön değerlendirme, belgeler, görüşme notu, epikriz, laboratuvar, tanı/işlem kodları, takip ve ikinci görüş kayıtları |
| **Aydınlatma Metni** | [Belge A01](/aydinlatma) |

---

## 3. ÜYELİK ŞARTLARI

**3.1.** Platform **18 yaşını doldurmuş** gerçek kişilere açıktır. Kayıtta doğum tarihi beyanı alınır ve saklanmaz;
18 yaşını doldurmamış kişi adına hesap açılamaz.

**3.2.** Kullanıcı, kayıt ve başvurularda verdiği bilgilerin **doğru, güncel ve kendisine ait** olduğunu; sağlık
bilgilerini eksiksiz verdiğini kabul eder. Eksik veya yanlış sağlık bilgisi, Doktor'un değerlendirmesini doğrudan etkiler
ve sorumluluğu Kullanıcı'ya aittir.

**3.3.** Hesap **kişiseldir**; hesap bilgileri paylaşılamaz, devredilemez. Her kişi tek hesap açar. Google veya Apple
hesabıyla giriş, aynı e-posta adresine bağlı tek hesap açar.

**3.4.** Kullanıcı, **başkasına ait** sağlık bilgisi veya belgeyi ancak o kişinin bilgisi ve rızasıyla yükleyebilir.
Ücretsiz Sağlık Hizmeti başvurusunda yakını adına bilgi giren Kullanıcı, formdaki beyan kutusunu işaretleyerek o kişinin
bilgisi ve rızasını aldığını, kişi reşit değilse yasal temsilcisi olduğunu beyan eder; beyanın doğruluğundan ve
sonuçlarından Kullanıcı sorumludur.

**3.5.** E-posta adresinin doğrulanması hesabın kullanım şartıdır; doğrulama bağlantısı kayıtlı adresinize gönderilir.

**3.6.** Yurt dışında yerleşik Kullanıcılar Platform'u kendi ülkelerinin mevzuatı çerçevesinde kullanır; Platform, her
ülkede uzaktan sağlık hizmetine erişimin serbest olduğunu garanti etmez.

---

## 4. HİZMETİN NİTELİĞİ VE SINIRLARI

**4.1. Koordinasyon platformu.** AURA; Kullanıcı'yı uygun uzmanlık alanındaki Doktor'la buluşturan, görüşmeyi,
ikinci görüşü, sağlık turizmi planlamasını ve ameliyat sonrası takibi **koordine eden ve ileten** bir dijital
platformdur. Uzaktan sağlık hizmetinin kendisi Doktor ve Klinik Hizmet Sağlayıcı tarafından sunulur (Belge A03).

**4.2. Tıbbi karar Doktor'undur.** Tanı, tedavi, ilaç ve sevk kararları yalnız yetkili Doktor tarafından verilir.
Platform tıbbi tavsiye vermez; ekranda gösterilen uzmanlık önerisi, aciliyet sırası, taslak not ve rapor özetleri
Doktor'un değerlendirmesinin yerine geçmez.

**4.3. Acil servis değildir.** Platform acil sağlık hizmeti sunmaz. Hayati tehlike, ağır yaralanma, göğüs ağrısı,
nefes darlığı, bilinç kaybı gibi acil durumlarda Kullanıcı derhâl **112**'yi (bulunduğu ülkenin acil numarasını) aramalı
veya en yakın acil servise başvurmalıdır. Ön değerlendirmede yüksek aciliyet saptanan başvurular nöbetçi doktora
yönlendirilir; bu yönlendirme acil müdahale yerine geçmez.

**4.4. Yapay zekâ destekli adımlar öneri niteliğindedir.** Ön değerlendirme, görüşme notu taslağı, epikriz taslağı,
iyileşme fotoğrafı analizi ve çeviri yapay zekâ desteğiyle yapılabilir; her biri Doktor tarafından değerlendirilir,
hiçbiri tek başına tıbbi karar oluşturmaz. Bu adımlar yalnız Kullanıcı'nın **ayrı açık rızasıyla** çalışır (Belge A04).

**4.5. Uzaktan görüşmenin sınırları.** Fiziksel muayene, girişimsel işlem veya cihaz gerektiren değerlendirmeler
uzaktan yapılamaz; Doktor gerekli gördüğünde Kullanıcı'yı yüz yüze muayeneye veya acil servise yönlendirebilir ve
görüşmeyi bu gerekçeyle sonlandırabilir. Platform üzerinden **e-reçete düzenlenmez**; Doktor'un ilaç ve işlem önerileri
bilgilendirme niteliğindedir *(bkz. Belge A03 madde 3)*.

**4.6. Doktor'un konumu.** Doktor, mesleki kararlarında bağımsızdır ve verdiği klinik görüşten, düzenlediği kayıtlardan
ve mesleki/etik kurallara uygunluktan **kendisi sorumludur**. Platform, Doktor'un mesleki belgelerini doğrular;
"akreditasyon" iddiasında bulunmaz.

**4.7. İkinci Görüş bağlayıcı değildir.** İkinci görüş, mevcut Doktor'unuzun tanı ve tedavi planının yerine geçmez;
tedavi kararı Kullanıcı ile tedavi eden doktoruna aittir.

**4.8. Sağlık turizmi önizlemesi endikatiftir.** Gösterilen paket bedeli, sigorta primi, tedavi süresi ve seyahat
kalemleri **tahmini ve bağlayıcı olmayan** önizlemedir; bağlayıcı teklif ancak Doktor'un klinik değerlendirmesinden
sonra ve gerçek rezervasyon akışı devreye alındığında doğar (Belge A08).

**4.9. Ücretsiz Sağlık Hizmeti gönüllülük esaslıdır.** Gönüllü doktorun müsaitliği garanti edilmez; başvuru sıraya
alınır. Görüşme sonrası tedavi gerekirse tedavi uygunluğu Etik Kurul değerlendirmesine bağlıdır; Platform tedavi,
bağış veya finansman taahhüt etmez.

**4.10. Süreklilik.** Platform hizmeti kesintisiz sunmayı hedefler; bakım, güncelleme, üçüncü kişi sağlayıcı kesintisi
veya mücbir sebeple erişim geçici olarak durabilir. Belirli bir Doktor'un müsaitliği garanti edilmez.

---

## 5. BAŞVURU YOLLARI VE SÜREÇ

**5.1. Doktorla görüşme.** Kullanıcı şikâyetini girer → ön değerlendirme uygun uzmanlık alanını ve aciliyeti belirler
→ zorunlu belgeler yüklenir veya "temin edeceğim" beyanı verilir (eksik belgeyle açılan düşük aciliyetli başvuru,
belgeler tamamlanana kadar doktor havuzuna düşmez; Kullanıcı'ya günde bir hatırlatma yapılır) → görüşme ücreti
adımı (madde 6) → Doktor eşleştirmesi. Uzmanlık alanında çevrimiçi Doktor yoksa Kullanıcı üç seçenekten birini
seçer: **(a)** nöbetçi doktorla şimdi görüşme, **(b)** uzmanlık alanı doktorundan randevu teklifi bekleme (en erken
uygun zaman iletilir; Kullanıcı kabul eder veya değişiklik ister), **(c)** süreci sonlandırma — bu durumda başvuru
verileri silinir ve (gerçek tahsilat varsa) ücret iade edilir. Görüşme sonunda Doktor not ve gerekirse rapor düzenler.

**5.2. İkinci Görüş.** Kullanıcı dosyasını ve belgelerini yükler (zorunlu belge kontrolü) → uzmanlık alanındaki doktor
başvuruyu kabul eder → yazılı görüş, Platform'da gösterilen **iş günü aralığında** hazırlanır ("Tahmini teslim" tarihi
gösterilir) → uzman isteğe bağlı görüntülü görüşme teklif edebilir; Kullanıcı kabul eder veya tarih değişikliği ister.
Ücret madde 6.

**5.3. Sağlık Turizmi Planlaması.** Klinik değerlendirme önce gelir: Kullanıcı şikâyetini ve tercihlerini girer,
endikatif paket önizlemesini görür, talep oluşturur → uzmanlık alanı doktoru inceler, gerekirse görüşme teklif eder →
Doktor onayından sonra paket ve (simüle) rezervasyon → yolculuk aşamaları (karşılama, otel, hastane, tedavi, taburcu)
Platform'da izlenir. Sigorta seviyesi için sağlık beyanı ayrı rızayla alınır. AURA dışında yapılan organizasyonlar için
Belge A08 sorumluluk bildirimi geçerlidir.

**5.4. Ücretsiz Sağlık Hizmeti.** Başvuru sıraya alınır; gönüllü doktor müsait olunca Kullanıcı'ya bildirim gider →
görüşme → tedavi gerekiyorsa Etik Kurul uygunluk değerlendirmesi.

**5.5. Ameliyat Sonrası Takip.** Doktor takibi başlatır; Kullanıcı günlük kontrol formunu doldurur, isterse fotoğraf
yükler. Uyarı işareti saptanırsa tedavi eden Doktor ve nöbetçi doktor bilgilendirilir. Takip, Doktor'un "Takibi
tamamla" kararıyla veya uzmanlık alanına göre belirlenen süre dolunca kapanır; kapanınca klinik personelin erişimi
sona erer ve kayıt yalnız Kullanıcı'ya kalır. Kullanıcı takibi yeniden açabilir.

**5.6. Bildirimler.** Süreç bildirimleri uygulama içinde ve (izin verilmişse) tarayıcı bildirimi olarak iletilir;
e-posta kanalını seçen Kullanıcı'ya e-posta ile de iletilir; SMS kanalı etkinleştiğinde SMS ile iletilir. Bildirimler ad ve
sağlık bilgisi içermez.

---

## 6. ÜCRET, ÖDEME VE İADE

**6.1. Bugünkü durum.** Platform'da gösterilen görüşme ücreti, İkinci Görüş ücreti, paket bedeli, emanet (escrow)
tutarları ve sigorta primleri **simülasyondur**; Kullanıcı'dan ödeme kartı veya banka bilgisi istenmez, tahsilat
yapılmaz, poliçe düzenlenmez. "Ödeme" adımı süreç akışını temsil eder.

**6.2. Gerçek tahsilata geçiş.** Ücretli hizmet sunulmaya başlandığında bu madde; ücretin unsurları, ödeme aracı,
mesafeli sözleşmelere ilişkin **ön bilgilendirme**, **cayma hakkı** ve istisnaları (hizmetin Kullanıcı'nın açık onayıyla
cayma süresi dolmadan ifasına başlanması), iade ve emanet kuralları ile birlikte güncellenir; sürüm artar ve
Kullanıcı yeniden onaylar. Gerçek tahsilat başlamadan hiçbir ücret talep edilmez. Bu hükümlerin taslağı **Ek 1**'de yer
alır; Ek 1, gerçek tahsilat başlayana kadar yürürlükte değildir.

**6.3. Etik Kurul kararları.** Etik Kurul, rezervasyona ilişkin tam veya kısmi iade kararı verebilir (madde 9);
bugün bu kararlar simüle emanet üzerinde uygulanır.

**6.4.** Ücretsiz Sağlık Hizmeti Kullanıcı için ücretsizdir.

**6.5.** Kullanıcı, madde 5.1-(c) ile süreci sonlandırdığında ön değerlendirme aşamasındaki başvuru verileri silinir;
Doktor görüşmesi yapılmış bir başvuru bu yolla silinemez (klinik kayıt — Belge A06).

---

## 7. KULLANICININ YÜKÜMLÜLÜKLERİ

**7.1.** Hesap güvenliğini (parola, cihaz) korumak; yetkisiz erişim şüphesinde derhâl parola değiştirmek veya tüm
cihazlardan çıkış yapmak.

**7.2.** Platform'u yalnız kendi sağlık ihtiyacı (veya madde 3.4 kapsamında yakını) için kullanmak; ticari, reklam
veya üçüncü kişiler adına aracılık amacıyla kullanmamak.

**7.3.** Aşağıdakiler **yasaktır**: başkasına ait veriyi rızasız yüklemek · uzaktan görüşmeyi Doktor'un bilgisi ve
rızası olmadan kaydetmek · Doktor'a veya personele hakaret, tehdit, taciz · Platform'un güvenlik mekanizmalarını
aşmaya çalışmak, otomatik araçlarla veri toplamak · yanlış aciliyet beyanıyla nöbetçi doktoru meşgul etmek · Paylaşım
Bağlantısı'nı yetkisiz kişilere vermek.

**7.4.** Doktor'un önerilerine uyup uymamak Kullanıcı'nın kararıdır; Kullanıcı tedaviyi reddetme hakkına sahiptir ve
sonuçlarından kendisi sorumludur.

**7.5.** Kullanıcı, teknik gereksinimleri (kamera, mikrofon, yeterli bağlantı) sağlamakla yükümlüdür; görüşme öncesi
cihaz testi Platform'da sunulur.

---

## 8. SAĞLIK KAYITLARININ PAYLAŞIMI

**8.1.** Kullanıcı, klinik kayıtlarının seçtiği kategorilerini (epikriz · görüşme notu · laboratuvar · radyoloji)
Paylaşım Bağlantısı ile üçüncü kişiye açabilir; süre, parola ve indirme izni Kullanıcı'nın seçimidir; bağlantı her an
iptal edilebilir; alıcının her erişimi kaydedilir ve Kullanıcı'ya gösterilir.

**8.2.** Bağlantıyı kime verdiğinden ve alıcının kullanımından Kullanıcı sorumludur. Platform, bağlantı ve parolanın
üçüncü kişilerce ele geçirilmesinden — Platform'un kusuru olmadıkça — sorumlu değildir.

**8.3.** Kullanıcı, klinik kayıtlarını standart (FHIR) biçimde dışa aktarabilir; dışa aktarılan dosyanın saklanması ve
paylaşılması Kullanıcı'nın sorumluluğundadır.

---

## 9. ETİK KURUL

**9.1.** Kullanıcı, hizmet süreciyle ilgili şikâyetini Etik Kurul'a iletebilir. Kurul başvuruyu Kullanıcı'nın
**kimliğini görmeden** inceler; Doktor veya ilgili tarafın savunmasını alır.

**9.2.** Kurul; tam veya kısmi iade, tedarikçi/doktor değişikliği, uyarı veya işlem yapılmaması kararlarından birini
verir; karar gerekçesiyle Kullanıcı'ya bildirilir. Kararlar Platform içi yaptırım niteliğindedir; Kullanıcı'nın
yasal başvuru hakları saklıdır.

**9.3.** AURA dışında organize edilen tedavi ve seyahatler için Etik Kurul başvurusu **açılmaz** (Belge A08).

---

## 10. KİŞİSEL VERİLER

**10.1.** Kişisel verilerin işlenmesi [Belge A01](/aydinlatma)'de aydınlatılır; sağlık verileri ve yapay zekâ adımları için açık rıza
**ayrı** alınır. Bu sözleşmenin onaylanması açık rıza yerine geçmez.

**10.2.** Kullanıcı hesabını **Hesabım** sayfasından silebilir: kişisel verileri derhâl silinir; klinik kayıtlar
yasal saklama süresi boyunca erişime kapatılır ve süre sonunda imha edilir ([Belge A01](/aydinlatma) madde 8 · Belge A06).

---

## 11. FİKRİ MÜLKİYET

**11.1.** Platform'un yazılımı, tasarımı, markası ve Platform tarafından üretilen içerik Platform'a aittir; Kullanıcı'ya
yalnız kişisel kullanım için devredilemez, sınırlı bir kullanım hakkı tanınır.

**11.2.** Kullanıcı'nın yüklediği belgeler ve girdiği bilgiler Kullanıcı'ya aittir; Kullanıcı, bunların hizmetin
sunulması amacıyla (Doktor'a iletilmesi, çeviri, rapor hazırlanması) işlenmesine izin verir. Doktor'un düzenlediği
rapor ve notlar Kullanıcı'nın sağlık kaydıdır; Kullanıcı bunlara erişir ve dışa aktarabilir.

---

## 12. SORUMLULUĞUN SINIRLARI

**12.1.** Tüketici mevzuatının emredici hükümleri saklıdır; bu madde Kullanıcı'nın tüketici olarak sahip olduğu hakları
daraltmaz.

**12.2.** Tıbbi değerlendirme, tanı, tedavi ve önerilerden doğan sorumluluk Doktor'a ve Klinik Hizmet Sağlayıcı'ya
aittir; Platform koordinasyon ve iletişim hizmetinin gereği gibi ifasından sorumludur.

**12.3.** Platform; Kullanıcı'nın eksik/yanlış bilgi vermesinden, madde 7'ye aykırı kullanımından, üçüncü kişi
sağlayıcı (barındırma, video röle, tercüme) kesintilerinden ve mücbir sebepten kaynaklanan zararlardan, kendi kastı
veya ağır ihmali bulunmadıkça sorumlu değildir.

**12.4.** AURA dışında organize edilen tedavi, seyahat ve anlaşmalardan Platform sorumlu değildir (Belge A08).

---

## 13. ÜYELİĞİN ASKIYA ALINMASI VE SONA ERMESİ

**13.1.** Kullanıcı üyeliğini dilediği zaman hesap silme yoluyla sona erdirebilir (madde 10.2).

**13.2.** Platform, aşağıdaki hâllerde üyeliği askıya alabilir veya sona erdirebilir: **(a)** madde 3'e aykırı
beyan (yaş, kimlik, başkasının verisi), **(b)** madde 7.3'teki yasakların ihlali, **(c)** Doktor veya personele
yönelik hakaret/tehdit/taciz, **(d)** Etik Kurul kararı, **(e)** hukuki zorunluluk.

**13.3.** Askıya alma veya sona erdirme kararı Kullanıcı'ya **gerekçesiyle** bildirilir; Kullanıcı bildirimden itibaren
**15 gün** içinde platform içi başvuru formuyla ([/kvkk-basvuru](/kvkk-basvuru)) itiraz edebilir; itiraz **30 gün** içinde gerekçeli cevaplanır
(süreler takvim günüdür). Açık bir Uzaktan Görüşme veya takip varsa
Kullanıcı'nın sağlığını tehlikeye atmayacak geçiş düzenlemesi yapılır.

**13.4.** Üyelik sona erdiğinde klinik kayıtlar Belge A06'ya göre saklanır ve imha edilir.

---

## 14. DEĞİŞİKLİKLER

Platform bu sözleşmeyi değiştirebilir. Esaslı değişikliklerde sürüm numarası artırılır, değişiklik Platform'da
duyurulur ve Kullanıcı'dan ilk girişte **yeniden onay** alınır; onay verilmezse yalnız hesap silme ve kayıt dışa
aktarma işlevleri kullanılabilir.

---

## 15. UYGULANACAK HUKUK VE YETKİ

**15.1.** İşbu sözleşmeye Türk hukuku uygulanır.

**15.2.** Tüketici uyuşmazlıklarında tüketici hakem heyetleri ve tüketici mahkemelerinin görevi ile Kullanıcı'nın
yerleşim yeri mahkemesinin yetkisi saklıdır; bunlar dışındaki uyuşmazlıklarda **İzmir Mahkemeleri ve İcra Daireleri**
yetkilidir.

**15.3.** Türkiye dışında yerleşik Kullanıcı bakımından, yerleşim yeri hukukunun emredici tüketici koruma hükümleri
saklıdır.

---

## 16. DİL

Sözleşmenin Türkçe metni bağlayıcıdır; İngilizce metin ikinci kanonik metindir ve Türkçe ile çelişmesi hâlinde
Türkçe esas alınır. Diğer dillerdeki sunumlar bilgilendirme amaçlıdır.

---

## 17. YÜRÜRLÜK

Bu sözleşme, Kullanıcı'nın kayıtta onayıyla yürürlüğe girer; sürüm ve yürürlük tarihi belgenin başında yer alır.

---

## EK 1 — MESAFELİ SÖZLEŞME ÖN BİLGİLENDİRMESİ VE CAYMA HAKKI

**Yürürlük: gerçek tahsilatın başlaması — bugün uygulanmaz, yayımlanmaz**.

**E1.1. Sağlayıcı bilgileri.** AURA platform işleticisi *(tüzel kişilik kuruluşunda ticaret unvanı, adres, MERSİS/vergi numarası, e-posta ve KEP adresi bu bölüme eklenecektir)*.

**E1.2. Hizmetin temel nitelikleri ve fiyat.** Satın alınan hizmet (uzaktan görüşme · ikinci görüş · sağlık turizmi paketi
kalemleri), tüm vergiler dâhil toplam bedeli, ödeme aracı ve ifa zamanı ödeme adımından önce ekranda gösterilir ve
Kullanıcı'ya kalıcı veri saklayıcısıyla (e-posta / hesap sayfası) iletilir.

**E1.3. Cayma hakkı.** Kullanıcı, sözleşmenin kurulduğu tarihten itibaren **14 gün** içinde gerekçe göstermeksizin cayabilir.
İstisnalar: **(a)** Kullanıcı'nın açık onayıyla cayma süresi dolmadan ifasına başlanan ve tamamlanan hizmetler
(gerçekleşmiş uzaktan görüşme; hazırlanmaya başlanmış ikinci görüş raporu); **(b)** Kullanıcı'nın isteği doğrultusunda
kişiselleştirilen hizmetler; **(c)** belirli bir tarihte ifası kararlaştırılan seyahat, konaklama ve transfer kalemleri.
Kullanıcı, cayma süresi dolmadan ifaya başlanmasını istiyorsa bunu ayrıca onaylar ve cayma hakkını bu ölçüde kaybettiğini
kabul eder.

**E1.4. Cayma bildirimi ve iade.** Cayma, hesap sayfasındaki cayma formuyla bildirilir;
bildirimden itibaren **14 gün** içinde, ödeme aracıyla aynı yöntemle iade yapılır.

**E1.5. Emanet (escrow).** Sağlık turizmi paketinde ödenen tutar, ifa tamamlanana kadar emanet hesabında tutulur; iade ve
serbest bırakma kuralları ile Etik Kurul iade kararlarının uygulanması bu maddede düzenlenir.

**E1.6. Şikâyet.** Tüketici hakem heyetleri ve tüketici mahkemeleri (madde 15.2).
`;

export const KOSULLAR_EN = `## 1. PARTIES AND SUBJECT MATTER

**1.1.** This agreement governs the terms of use of the coordination and communication services offered by **the AURA platform operator** (the "**Platform**" or "**AURA**") to the natural person who registers on the AURA telehealth platform as a patient (the "**User**").

**1.2.** By accepting this agreement at registration, the User is deemed to have accepted its terms. The acceptance record is written to a tamper-evident record chain together with the digest (hash) of the accepted text, the date-time and device information.

**1.3.** The Platform and the User are hereinafter referred to individually as a "**Party**" and jointly as the "**Parties**".

**1.4.** The privacy notice on the processing of personal data is set out in **[Document A01](/aydinlatma)** and the information on the telehealth service in **Document A03**; both form an integral part of this agreement.

---

## 2. DEFINITIONS

| Term | Meaning |
|---|---|
| **Doctor** | A doctor whose professional identity has been verified (e-Devlet barcoded diploma) and whose clinical activation has been approved by Platform management, who is assigned to the User or accepts the User's case |
| **Clinical Service Provider** | The health facility or doctor that actually provides the remote health service and is authorised under the applicable legislation: *(the provider's identity will be added to this section when the authorisation certificate is obtained)* |
| **Case** | The file the User opens on the Platform that is routed to a specialty (together with the preliminary assessment, documents, consultation and follow-up records) |
| **Preliminary Assessment** | Routing of the complaint to the appropriate specialty and urgency ranking; AI support only with explicit consent |
| **Remote Consultation** | A video/audio consultation between the Doctor and the User conducted through the Platform |
| **Second Opinion** | A written specialist opinion on an existing diagnosis or treatment plan, based on documents; optional video consultation |
| **Free Care** | Free remote consultation with volunteer doctors for Users of limited financial means |
| **Health Tourism Planning** | The **preview and coordination** of treatment, travel and accommodation through the Platform (Document A08) |
| **Post-operative Follow-up** | Daily check-ins and doctor monitoring after treatment |
| **Sharing Link** | A link that opens the health records selected by the User to a third party on a time-limited, encrypted and revocable basis |
| **Ethics Board** | The Platform's internal independent review body; reviews applications anonymously |
| **Clinical Record** | Preliminary assessment, documents, consultation note, discharge summary, laboratory, diagnosis/procedure codes, follow-up and second opinion records |
| **Privacy Notice** | [Document A01](/aydinlatma) |

---

## 3. MEMBERSHIP REQUIREMENTS

**3.1.** The Platform is open to natural persons who are **18 years of age or older**. A declaration of date of birth is taken at registration and is not stored; no account may be opened on behalf of a person under 18.

**3.2.** The User accepts that the information given at registration and in cases is **accurate, current and their own**, and that they have provided their health information completely. Incomplete or incorrect health information directly affects the Doctor's assessment and is the User's responsibility.

**3.3.** The account is **personal**; account details may not be shared or transferred. Each person opens a single account. Signing in with a Google or Apple account opens a single account linked to the same e-mail address.

**3.4.** The User may upload health information or documents **belonging to another person** only with that person's knowledge and consent. A User who enters information on behalf of a relative in a Free Care application declares, by ticking the declaration box on the form, that they have obtained that person's knowledge and consent and, if the person is a minor, that they are their legal representative; the User is responsible for the accuracy and consequences of the declaration.

**3.5.** Verification of the e-mail address is a condition of using the account; the verification link is sent to your registered address.

**3.6.** Users resident abroad use the Platform within the framework of the legislation of their own country; the Platform does not guarantee that access to remote health services is unrestricted in every country.

---

## 4. NATURE AND LIMITS OF THE SERVICE

**4.1. Coordination platform.** AURA is a digital platform that connects the User with a Doctor in the appropriate specialty and **coordinates and relays** the consultation, second opinion, health tourism planning and post-operative follow-up. The remote health service itself is provided by the Doctor and the Clinical Service Provider (Document A03).

**4.2. Medical decisions are the Doctor's.** Diagnosis, treatment, medication and referral decisions are made solely by the licensed Doctor. The Platform does not give medical advice; the specialty suggestion, urgency ranking, draft notes and report summaries shown on screen do not replace the Doctor's assessment.

**4.3. Not an emergency service.** The Platform does not provide emergency health services. In emergencies such as a life-threatening condition, serious injury, chest pain, shortness of breath or loss of consciousness, the User must immediately call **112** (or the emergency number of the country they are in) or go to the nearest emergency department. Cases found to be of high urgency in the preliminary assessment are routed to the on-duty doctor; this routing does not replace emergency care.

**4.4. AI-assisted steps are advisory.** The preliminary assessment, draft consultation note, draft discharge summary, recovery photo analysis and translation may be carried out with AI support; each is evaluated by the Doctor and none on its own constitutes a medical decision. These steps run only with the User's **separate explicit consent** (Document A04).

**4.5. Limits of remote consultation.** Assessments requiring physical examination, interventional procedures or devices cannot be performed remotely; where the Doctor considers it necessary, they may refer the User to a face-to-face examination or an emergency department and end the consultation on that ground. **No e-prescription is issued** through the Platform; the Doctor's medication and procedure recommendations are for information *(see Document A03, Section 3)*.

**4.6. The Doctor's position.** The Doctor is independent in their professional decisions and is **personally responsible** for the clinical opinion given, the records prepared and compliance with professional/ethical rules. The Platform verifies the Doctor's professional documents; it makes no claim of "accreditation".

**4.7. A Second Opinion is not binding.** A second opinion does not replace the diagnosis and treatment plan of your current Doctor; the treatment decision belongs to the User and their treating doctor.

**4.8. The health tourism preview is indicative.** The package price, insurance premium, treatment duration and travel items shown are an **estimated, non-binding** preview; a binding offer arises only after the Doctor's clinical assessment and once the real booking flow is put into operation (Document A08).

**4.9. Free Care is voluntary.** The availability of a volunteer doctor is not guaranteed; applications are queued. If treatment is required after the consultation, eligibility for treatment is subject to Ethics Board review; the Platform does not undertake to provide treatment, donations or funding.

**4.10. Continuity.** The Platform aims to provide the service without interruption; access may be temporarily suspended due to maintenance, updates, third-party provider outages or force majeure. The availability of a particular Doctor is not guaranteed.

---

## 5. CASE TYPES AND PROCESS

**5.1. Talk to a doctor.** The User enters their complaint → the preliminary assessment determines the appropriate specialty and urgency → mandatory documents are uploaded or an "I will provide them" declaration is given (a low-urgency case opened with missing documents does not enter the doctor pool until the documents are complete; the User receives one reminder per day) → consultation fee step (Section 6) → Doctor matching. If no Doctor in the specialty is online, the User chooses one of three options: **(a)** an immediate consultation with the on-duty doctor, **(b)** waiting for an appointment offer from a specialty doctor (the earliest available time is communicated; the User accepts or requests a change), **(c)** ending the process — in which case the case data is deleted and (if real payment was collected) the fee is refunded. At the end of the consultation the Doctor prepares a note and, where necessary, a report.

**5.2. Second Opinion.** The User uploads their file and documents (mandatory document check) → a doctor in the specialty accepts the case → the written opinion is prepared within the **business-day range shown on the Platform** (an "Estimated delivery" date is displayed) → the specialist may optionally offer a video consultation; the User accepts or requests a change of date. Fees: Section 6.

**5.3. Health Tourism Planning.** Clinical assessment comes first: the User enters their complaint and preferences, sees the indicative package preview and creates a request → the specialty doctor reviews and, where necessary, offers a consultation → after the Doctor's approval, the package and (simulated) booking → the journey stages (welcome, hotel, hospital, treatment, discharge) are tracked on the Platform. The health declaration for the insurance level is obtained with separate consent. The Document A08 liability notice applies to arrangements made outside AURA.

**5.4. Free Care.** The application is queued; the User is notified when a volunteer doctor becomes available → consultation → Ethics Board eligibility review if treatment is required.

**5.5. Post-operative Follow-up.** The Doctor starts the follow-up; the User completes the daily check-in form and may upload photos. If a warning sign is detected, the treating Doctor and the on-duty doctor are informed. Follow-up closes with the Doctor's "Complete follow-up" decision or when the period determined for the specialty expires; on closure, clinical staff access ends and the record remains with the User only. The User may reopen the follow-up.

**5.6. Notifications.** Process notifications are delivered in-app and (if permitted) as browser notifications; a User who has chosen the e-mail channel also receives them by e-mail; they will be delivered by SMS when the SMS channel is activated. Notifications contain no name or health information.

---

## 6. FEES, PAYMENT AND REFUNDS

**6.1. Current position.** The consultation fee, Second Opinion fee, package price, escrow amounts and insurance premiums shown on the Platform are a **simulation**; no payment card or bank details are requested from the User, no charges are collected and no policy is issued. The "payment" step represents the process flow.

**6.2. Transition to real payment collection.** When paid services begin, this Section will be updated together with the elements of the fee, the payment instrument, **pre-contractual information** for distance contracts, the **right of withdrawal** and its exceptions (performance of the service beginning, with the User's express approval, before the withdrawal period expires), refund and escrow rules; the version will be increased and the User will accept the agreement again. No fee is requested before real payment collection begins. A draft of these provisions is set out in **Annex 1**; Annex 1 is not in force until real payment collection begins.

**6.3. Ethics Board decisions.** The Ethics Board may decide on a full or partial refund relating to a booking (Section 9); today such decisions are applied to the simulated escrow.

**6.4.** Free Care is free of charge for the User.

**6.5.** When the User ends the process under Section 5.1(c), the case data at the preliminary assessment stage is deleted; a case in which a Doctor consultation has taken place cannot be deleted in this way (clinical record — Document A06).

---

## 7. USER OBLIGATIONS

**7.1.** To protect account security (password, device); on suspicion of unauthorised access, to change the password immediately or sign out of all devices.

**7.2.** To use the Platform only for their own health needs (or those of a relative under Section 3.4); not to use it for commercial or advertising purposes or as an intermediary on behalf of third parties.

**7.3.** The following are **prohibited**: uploading another person's data without consent · recording a remote consultation without the Doctor's knowledge and consent · insulting, threatening or harassing the Doctor or staff · attempting to circumvent the Platform's security mechanisms or collecting data with automated tools · occupying the on-duty doctor with a false urgency declaration · giving a Sharing Link to unauthorised persons.

**7.4.** Whether or not to follow the Doctor's recommendations is the User's decision; the User has the right to refuse treatment and is responsible for the consequences.

**7.5.** The User is responsible for meeting the technical requirements (camera, microphone, adequate connection); a device test is offered on the Platform before the consultation.

---

## 8. SHARING OF HEALTH RECORDS

**8.1.** The User may open the categories of their clinical records that they select (discharge summary · consultation note · laboratory · radiology) to a third party via a Sharing Link; the duration, password and download permission are the User's choice; the link may be revoked at any time; every access by the recipient is recorded and shown to the User.

**8.2.** The User is responsible for whom they give the link to and for the recipient's use. The Platform is not liable for the link and password being obtained by third parties, unless the Platform is at fault.

**8.3.** The User may export their clinical records in a standard (FHIR) format; storing and sharing the exported file is the User's responsibility.

---

## 9. ETHICS BOARD

**9.1.** The User may submit a complaint about the service process to the Ethics Board. The Board reviews the application **without seeing the User's identity** and obtains the defence of the Doctor or the party concerned.

**9.2.** The Board issues one of the following decisions: full or partial refund, change of supplier/doctor, warning, or no action; the decision is communicated to the User with its reasons. Decisions are in the nature of Platform-internal sanctions; the User's legal remedies are reserved.

**9.3.** No Ethics Board application is opened for treatment and travel arranged outside AURA (Document A08).

---

## 10. PERSONAL DATA

**10.1.** The processing of personal data is explained in [Document A01](/aydinlatma); explicit consent for health data and AI steps is obtained **separately**. Acceptance of this agreement does not replace explicit consent.

**10.2.** The User may delete their account from the **My Account** page: personal data is deleted immediately; clinical records are closed to access for the statutory retention period and destroyed at its end ([Document A01](/aydinlatma), Section 8 · Document A06).

---

## 11. INTELLECTUAL PROPERTY

**11.1.** The Platform's software, design, brand and the content produced by the Platform belong to the Platform; the User is granted only a non-transferable, limited right of use for personal purposes.

**11.2.** Documents uploaded and information entered by the User belong to the User; the User permits their processing for the purpose of providing the service (forwarding to the Doctor, translation, preparation of reports). Reports and notes prepared by the Doctor are the User's health record; the User may access and export them.

---

## 12. LIMITATION OF LIABILITY

**12.1.** The mandatory provisions of consumer legislation are reserved; this Section does not narrow the rights the User has as a consumer.

**12.2.** Liability arising from medical assessment, diagnosis, treatment and recommendations rests with the Doctor and the Clinical Service Provider; the Platform is responsible for the proper performance of the coordination and communication service.

**12.3.** The Platform is not liable for damage arising from incomplete/incorrect information given by the User, use contrary to Section 7, third-party provider outages (hosting, video relay, interpretation) or force majeure, unless the Platform has acted with intent or gross negligence.

**12.4.** The Platform is not liable for treatment, travel and agreements arranged outside AURA (Document A08).

---

## 13. SUSPENSION AND TERMINATION OF MEMBERSHIP

**13.1.** The User may end their membership at any time by deleting their account (Section 10.2).

**13.2.** The Platform may suspend or terminate membership in the following cases: **(a)** a declaration contrary to Section 3 (age, identity, another person's data), **(b)** breach of the prohibitions in Section 7.3, **(c)** insult/threat/harassment directed at a Doctor or staff, **(d)** an Ethics Board decision, **(e)** legal necessity.

**13.3.** A suspension or termination decision is communicated to the User **with its reasons**; the User may object via the in-platform request form ([/kvkk-basvuru](/kvkk-basvuru)) within **15 days** of the notice; the objection is answered with reasons within **30 days** (periods are calendar days). If there is an open Remote Consultation or follow-up, a transition arrangement that does not endanger the User's health is made.

**13.4.** When membership ends, clinical records are retained and destroyed in accordance with Document A06.

---

## 14. AMENDMENTS

The Platform may amend this agreement. In the case of material amendments, the version number is increased, the change is announced on the Platform and **renewed acceptance** is obtained from the User at the next sign-in; if acceptance is not given, only the account deletion and record export functions may be used.

---

## 15. GOVERNING LAW AND JURISDICTION

**15.1.** This agreement is governed by Turkish law.

**15.2.** In consumer disputes, the competence of consumer arbitration committees and consumer courts and the jurisdiction of the court of the User's place of residence are reserved; for other disputes the **Courts and Enforcement Offices of İzmir** have jurisdiction.

**15.3.** For Users resident outside Türkiye, the mandatory consumer protection provisions of the law of their place of residence are reserved.

---

## 16. LANGUAGE

The Turkish text of the agreement is binding; the English text is the second canonical text and, in case of conflict with the Turkish text, the Turkish text prevails. Presentations in other languages are for information only.

---

## 17. ENTRY INTO FORCE

This agreement enters into force upon the User's acceptance at registration; the version and effective date are stated at the top of the document.

---

## ANNEX 1 — PRE-CONTRACTUAL INFORMATION FOR DISTANCE CONTRACTS AND RIGHT OF WITHDRAWAL

**Entry into force: the start of real payment collection — not applied and not published today**.

**A1.1. Provider details.** The AURA platform operator *(when the legal entity is incorporated, the legal name, address, MERSİS/tax number, e-mail and KEP address will be added to this section)*.

**A1.2. Essential characteristics of the service and price.** The service purchased (remote consultation · second opinion · health tourism package items), its total price including all taxes, the payment instrument and the time of performance are shown on screen before the payment step and delivered to the User on a durable medium (e-mail / account page).

**A1.3. Right of withdrawal.** The User may withdraw within **14 days** of the conclusion of the contract without giving reasons. Exceptions: **(a)** services whose performance began, with the User's express approval, before the withdrawal period expired and which have been completed (a remote consultation that has taken place; a second opinion report whose preparation has begun); **(b)** services personalised at the User's request; **(c)** travel, accommodation and transfer items agreed for performance on a specific date. If the User wishes performance to begin before the withdrawal period expires, they approve this separately and accept that they lose the right of withdrawal to that extent.

**A1.4. Notice of withdrawal and refund.** Withdrawal is notified via the withdrawal form on the account page; the refund is made within **14 days** of the notice by the same method as the payment instrument.

**A1.5. Escrow.** In the health tourism package, the amount paid is held in an escrow account until performance is completed; refund and release rules and the implementation of Ethics Board refund decisions are governed by this Section.

**A1.6. Complaints.** Consumer arbitration committees and consumer courts (Section 15.2).
`;

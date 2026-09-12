// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/aura-hukuki-belgeler A07-veri-sahibi-basvuru-usul-esaslari.md + A07-data-subject-request-procedure.md (teslim/md TR · en/ EN) — Sürüm 1.0 · 12.09.2026 NİHAİ.
// Elle DÜZENLEME YOK: kaynak .md vault'ta; `python -X utf8 _yayin-kesiti.py` yeniden üretir. Kimlik etiketleri tüzel kişilik kurulana dek
// yayın yer tutucusuyla geçer; e-posta kanalı kutu açılana dek yayımlanmaz (platform içi form). Belge A0N atıfları yayımlı rotalara bağlıdır.
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (çelişkide TR esastır). Aynı dizeler onam kaydına hash'lenir (ekran = hash, dil başına).
export const KVKK_BASVURU_TR = `## A.1 Haklarınız

**KVKK m.11** uyarınca kişisel verileriniz bakımından:

1. İşlenip işlenmediğini öğrenme
2. İşlenmişse buna ilişkin bilgi talep etme
3. İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
4. Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
5. Eksik veya yanlış işlenmişse düzeltilmesini isteme
6. Silinmesini veya yok edilmesini isteme
7. Düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme
8. Münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonuç doğmasına itiraz etme
9. Hukuka aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme

haklarına sahipsiniz. **Avrupa Birliği'nde yerleşik iseniz** ayrıca GDPR kapsamında işlemenin kısıtlanmasını isteme,
**veri taşınabilirliği**, açık rızanızı geri alma ve kendi ülkenizin denetim otoritesine şikâyet haklarınız vardır.

## A.2 Başvuru kanalları

| Kanal | Adres |
|---|---|
| Platform içi form | \`/kvkk-basvuru\` — yalnız oturum açmış kullanıcıya açıktır (kimliği doğrulanmış oturum); hasta ve personel rolleri kullanabilir |
| E-posta | *(e-posta kanalı açıldığında bu bölüme eklenecektir)* |
| KEP adresi | *(tüzel kişilik kuruluşunda bildirilecektir)* |
| Yazılı başvuru (posta) | *(tüzel kişilik kuruluşunda bildirilecektir)* |

> **Kurgu:** KVKK ikincil mevzuatı başvuruyu yazılı olarak, KEP/güvenli e-imza/mobil imza ile veya **veri sorumlusuna
> daha önce bildirilmiş ve sistemde kayıtlı e-posta adresinden** öngörür. Platform içi form yalnız kayıtlı hesabınızdan,
> kimlik doğrulanmış oturumla iletilir; e-posta başvurusunda sistemde kayıtlı adresiniz esas alınır. Kayıtlı adresiniz
> dışından gelen başvuruda kimlik teyidi istenir.

## A.3 Başvurunuzda bulunması gerekenler

- Ad, soyad ve başvuru yazılı ise imza
- Türkiye Cumhuriyeti vatandaşları için T.C. kimlik numarası; yabancılar için uyruk, pasaport veya kimlik numarası
  *(yalnız kimlik teyidi için; başvuru dışında saklanmaz)*
- Tebligata esas yerleşim yeri veya iş yeri adresi; varsa e-posta ve telefon
- **Talep konusu** — hangi hakkınızı kullanmak istediğiniz; ilgiliyse hangi başvuru/kayıt

## A.4 Cevap süresi ve ücret

**A.4.1.** Başvurunuz niteliğine göre **en kısa sürede ve en geç otuz gün** içinde sonuçlandırılır. *(AB'de yerleşik
kullanıcılar için GDPR süresi bir aydır; karmaşık taleplerde bildirimle iki ay uzatılabilir.)*

**A.4.2.** İşlem ayrıca bir maliyet gerektirmiyorsa **ücretsizdir**; aksi hâlde Kurul'ca belirlenen tarifedeki ücret
alınabilir.

**A.4.3.** Başvurunuz reddedilirse ret **gerekçesiyle** bildirilir.

## A.5 Kurul'a şikâyet

Başvurunuzun reddedilmesi, cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâlinde; cevabı öğrendiğiniz
tarihten itibaren **otuz gün** ve her hâlde başvuru tarihinden itibaren **altmış gün** içinde Kişisel Verileri Koruma
Kurulu'na şikâyette bulunabilirsiniz. AB'de yerleşik iseniz kendi ülkenizin denetim otoritesine de başvurabilirsiniz.

## A.6 Hesap ve veri silme — platform içinden

Silme hakkınızı **Hesabım** sayfasından doğrudan kullanabilirsiniz: kişisel verileriniz derhâl silinir; **klinik
kayıtlarınız** yasal saklama süresi boyunca erişime kapatılır ve süre sonunda imha edilir ([Belge A01](/aydinlatma) madde 8). Silme
işlemi geri alınamaz; saklamak istediğiniz belgeleri silmeden önce indirin.

## A.7 Kayıtlarınıza erişim ve dışa aktarma — platform içinden

Klinik kayıtlarınızı Platform'da görüntüleyebilir, seçtiğiniz kategorileri paylaşım bağlantısıyla açabilir ve standart
biçimde (FHIR) dışa aktarabilirsiniz; erişim geçmişinizi \`/erisim-kaydi\`, rıza kayıtlarınızı \`/onam/kanit\`
sayfasından görebilirsiniz. Bu işlevler A.1'deki hakların platform içinden **kendiliğinden** kullanımıdır; ayrıca
başvuru gerekmez.
`;

export const KVKK_BASVURU_EN = `## A.1 Your rights

Under **Article 11 of the Law on the Protection of Personal Data (KVKK)**, in respect of your personal data you have the right:

1. to learn whether they are processed
2. to request information about the processing if they have been processed
3. to learn the purpose of the processing and whether they are used in accordance with that purpose
4. to know the third parties to whom they are transferred, in Türkiye or abroad
5. to request their rectification if they have been processed incompletely or inaccurately
6. to request their erasure or destruction
7. to request that rectification/erasure operations be notified to the third parties to whom the data were transferred
8. to object to a result arising against you through analysis exclusively by automated systems
9. to claim compensation for damage suffered as a result of unlawful processing.

**If you are established in the European Union**, you additionally have, under the GDPR, the rights to request restriction of processing, to **data portability**, to withdraw your explicit consent and to lodge a complaint with the supervisory authority of your own country.

## A.2 Request channels

| Channel | Address |
|---|---|
| In-platform form | \`/kvkk-basvuru\` — available only to signed-in users (authenticated session); patient and staff roles may use it |
| E-mail | *(to be added to this section when the e-mail channel is opened)* |
| Registered electronic mail (KEP) address | *(to be notified upon incorporation of the legal entity)* |
| Written request (post) | *(to be notified upon incorporation of the legal entity)* |

> **How it works:** the secondary legislation under the KVKK provides that a request be made in writing, via KEP / secure electronic signature / mobile signature, or **from an e-mail address previously notified to the data controller and registered in its system**. The in-platform form is submitted only from your registered account, with an authenticated session; for e-mail requests, your address registered in the system is taken as the basis. A request arriving from an address other than your registered one is subject to identity confirmation.

## A.3 What your request must contain

- Name, surname and, if the request is in writing, signature
- For citizens of the Republic of Türkiye, the T.C. identity number; for foreign nationals, nationality, passport or identity number *(solely for identity confirmation; not retained beyond the request)*
- Residential or workplace address for service of notices; e-mail and telephone if available
- **Subject of the request** — which right you wish to exercise; if relevant, which case/record

## A.4 Response time and fee

**A.4.1.** Your request is concluded according to its nature **as soon as possible and within thirty days at the latest**. *(For users established in the EU, the GDPR period is one month; for complex requests it may be extended by two months with notice.)*

**A.4.2.** The procedure is **free of charge** unless it requires a separate cost; otherwise the fee in the tariff set by the Board may be charged.

**A.4.3.** If your request is refused, the refusal is notified **with reasons**.

## A.5 Complaint to the Board

If your request is refused, you find the response insufficient or no response is given within the time limit, you may lodge a complaint with the Personal Data Protection Board within **thirty days** from the date you learn of the response and in any event within **sixty days** from the date of the request. If you are established in the EU, you may also apply to the supervisory authority of your own country.

## A.6 Account and data deletion — from within the platform

You can exercise your right to erasure directly from the **My Account** page: your personal data are deleted immediately; your **clinical records** are closed to access for the statutory retention period and destroyed at the end of that period ([Document A01](/aydinlatma), Section 8). Deletion cannot be undone; download the documents you wish to keep before deleting.

## A.7 Access to and export of your records — from within the platform

You can view your clinical records on the Platform, open the categories you select via a sharing link and export them in a standard format (FHIR); you can see your access history at \`/erisim-kaydi\` and your consent records at \`/onam/kanit\`. These functions are the **self-service** exercise, from within the platform, of the rights in A.1; no separate request is required.
`;

// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/aura-hukuki-belgeler A05-cerez-politikasi.md + A05-cookie-and-local-storage-policy.md (teslim/md TR · en/ EN) — Sürüm 1.0 · 12.09.2026 NİHAİ.
// Elle DÜZENLEME YOK: kaynak .md vault'ta; `python -X utf8 _yayin-kesiti.py` yeniden üretir. Kimlik etiketleri tüzel kişilik kurulana dek
// yayın yer tutucusuyla geçer; e-posta kanalı kutu açılana dek yayımlanmaz (platform içi form). Belge A0N atıfları yayımlı rotalara bağlıdır.
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (çelişkide TR esastır). Aynı dizeler onam kaydına hash'lenir (ekran = hash, dil başına).
export const CEREZ_TR = `## 1. Çerez ve yerel depolama nedir

Çerez, siteyi ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyasıdır; oturumun sürdürülmesi veya bir
tercihin hatırlanması gibi işlevler sağlar. Yerel depolama (localStorage) ise tarayıcınızın, yalnız o cihazda ve yalnız
bu site için sakladığı küçük tercih kayıtlarıdır; sunucuya gönderilmez.

---

## 2. AURA'da kullanılan çerezler

| Çerez adı | Türü | Amacı | Süre | Nitelik |
|---|---|---|---|---|
| \`session\` | Zorunlu / oturum | Giriş yapmış kullanıcının oturumunu sürdürmek; her istekte kimliğin doğrulanması | **7 gün** | \`HttpOnly\` (JavaScript erişemez), üretimde \`Secure\` (yalnız HTTPS), \`SameSite=Lax\` |
| \`theme\` | İşlevsel | Açık/koyu görünüm tercihinizi hatırlamak | Tercih değiştirilene kadar | Yalnız "light"/"dark" değeri; kişisel veri içermez |

**Bu ikisi dışında çerez kullanılmaz.** Reklam, profilleme, yeniden hedefleme veya üçüncü taraf ölçümleme çerezi yoktur.
Google/Apple ile giriş sırasında bu sağlayıcıların kendi sayfalarında kendi çerezleri çalışabilir; AURA bu çerezlere
erişmez.

---

## 3. Yerel depolama (localStorage) anahtarları

| Anahtar | Nerede | Ne saklar | Kişisel veri mi |
|---|---|---|---|
| \`air_lang\` | Vitrin ve hasta yüzeyleri | Arayüz dili tercihi (ör. "Türkçe") | Hayır |
| \`air_so_lang\` | İkinci Görüş akışı | Aynı tercih, akışa özgü | Hayır |
| \`air_preconsult_bigtext\` | Görüşme öncesi bekleme odası | "Büyük yazı" erişilebilirlik tercihi ("1"/"0") | Hayır |
| \`air_preconsult_note_<başvuru>\` | Bekleme odası "sormak istediklerim" notu | **Sizin yazdığınız not** — yalnız cihazınızda; doktora ve sunucuya **gönderilmez** | Siz yazarsanız içerik sizindir; sunucuya gitmez |
| \`air_share_*\` | Paylaşım bağlantısı görüntüleme ekranı | Bağlantıya özgü geçici görünüm bilgisi | Hayır |

Yerel depolama kayıtlarını tarayıcınızın site verilerini temizleyerek silebilirsiniz; bekleme odası notunuz cihazınızdan
silinir, başka bir yerde kopyası yoktur.

---

## 4. Hukuki dayanak ve rıza

**4.1.** \`session\` çerezi, talep ettiğiniz hizmetin (giriş) sunulabilmesi için **kesinlikle gereklidir**; bu nitelikteki
çerezler için önceden rıza aranmaz.

**4.2.** \`theme\` çerezi ve yerel depolama anahtarları yalnız görünüm/dil/erişilebilirlik tercihinizi ve kendi
notunuzu saklar; kişisel veri içermez (not hariç — o da cihazınızdan çıkmaz) ve tarafınızca doğrudan tetiklenir.

**4.3.** Bu nedenle AURA'da **çerez rıza penceresi (banner) sunulmamaktadır** — kullanılan çerez kümesinin niteliğinin
sonucudur. İleride analitik, reklam ölçümü veya üçüncü taraf bileşen eklenirse **eklenmeden önce** rıza katmanı kurulur
ve bu politika güncellenir.

---

## 5. Çerez kullanmayan ölçüm

AURA vitrininde bugün hiçbir kullanım ölçümü yoktur. Doctorium tanıtım sayfasındaki çerezsiz,
kimliksiz bölüm sayacı AURA'ya eklenirse: çerez kullanmaz, ziyaretçiye tanımlayıcı atamaz, IP/gezinme/sorgu kaydetmez;
yalnız olay adı, konumu, günü ve toplam sayı tutulur — kişisel veri niteliği taşımaz. Eklendiğinde bu madde ölçümü
tanımlar.

---

## 6. Tarayıcı ayarları

Çerezleri tarayıcı ayarlarından silebilir veya engelleyebilirsiniz; \`session\` çerezini engellerseniz **giriş
yapamazsınız**.

---

## 7. Değişiklikler

Yeni bir çerez veya benzeri teknoloji eklendiğinde bu politika güncellenir; rıza gerektiren bir çerez eklenmesi hâlinde
çerez yerleştirilmeden önce rızanız alınır.

---

## 8. İletişim

Platform içi başvuru formu: [/kvkk-basvuru](/kvkk-basvuru) → [Belge A07](/kvkk-basvuru) *(e-posta kanalı açıldığında adres bu bölüme eklenecektir)*.
`;

export const CEREZ_EN = `## 1. What cookies and local storage are

A cookie is a small text file saved to your browser when you visit the site; it provides functions such as maintaining your session or remembering a preference. Local storage (localStorage) consists of small preference records that your browser keeps only on that device and only for this site; they are not sent to the server.

---

## 2. Cookies used on AURA

| Cookie name | Type | Purpose | Duration | Properties |
|---|---|---|---|---|
| \`session\` | Strictly necessary / session | Maintaining the session of a signed-in user; verifying identity on every request | **7 days** | \`HttpOnly\` (not accessible to JavaScript), \`Secure\` in production (HTTPS only), \`SameSite=Lax\` |
| \`theme\` | Functional | Remembering your light/dark appearance preference | Until the preference is changed | Holds only the value "light"/"dark"; contains no personal data |

**No cookies are used other than these two.** There are no advertising, profiling, retargeting or third-party measurement cookies. When signing in with Google/Apple, those providers' own cookies may operate on their own pages; AURA does not access those cookies.

---

## 3. Local storage (localStorage) keys

| Key | Where | What it stores | Personal data? |
|---|---|---|---|
| \`air_lang\` | Public site and patient screens | Interface language preference (e.g. "Türkçe") | No |
| \`air_so_lang\` | Second Opinion flow | The same preference, specific to the flow | No |
| \`air_preconsult_bigtext\` | Pre-consultation waiting room | "Large text" accessibility preference ("1"/"0") | No |
| \`air_preconsult_note_<case>\` | Waiting room "questions I want to ask" note | **A note you write** — only on your device; **not sent** to the doctor or the server | If you write it, the content is yours; it does not go to the server |
| \`air_share_*\` | Sharing link viewing screen | Temporary, link-specific display information | No |

You can delete local storage records by clearing your browser's site data; your waiting room note is deleted from your device and there is no copy elsewhere.

---

## 4. Legal basis and consent

**4.1.** The \`session\` cookie is **strictly necessary** to provide the service you requested (sign-in); prior consent is not required for cookies of this kind.

**4.2.** The \`theme\` cookie and the local storage keys store only your appearance/language/accessibility preference and your own note; they contain no personal data (except the note — which also never leaves your device) and are triggered directly by you.

**4.3.** For this reason **no cookie consent window (banner) is presented** on AURA — this is a consequence of the nature of the cookie set used. If analytics, advertising measurement or third-party components are added in the future, a consent layer will be established **before** they are added and this policy will be updated.

---

## 5. Cookie-free measurement

There is no usage measurement on the AURA public site today. If the cookie-free, de-identified section counter used on the Doctorium promotional page is added to AURA: it uses no cookies, assigns no identifier to the visitor and records no IP, browsing history or queries; only the event name, its location, the day and the total count are kept — this does not constitute personal data. When added, this Section will describe the measurement.

---

## 6. Browser settings

You can delete or block cookies from your browser settings; if you block the \`session\` cookie, **you will not be able to sign in**.

---

## 7. Changes

This policy is updated when a new cookie or similar technology is added; if a cookie requiring consent is added, your consent will be obtained before the cookie is placed.

---

## 8. Contact

In-platform request form: [/kvkk-basvuru](/kvkk-basvuru) → [Document A07](/kvkk-basvuru) *(the e-mail address will be added to this section when the mailbox is opened)*.
`;

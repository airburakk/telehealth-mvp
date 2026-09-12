// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/aura-hukuki-belgeler A09-personel-aydinlatma-ve-rol-maddeleri.md + A09-staff-privacy-notice-and-role-clauses.md (teslim/md TR · en/ EN) — Sürüm 1.0 · 12.09.2026 NİHAİ.
// Elle DÜZENLEME YOK: kaynak .md vault'ta; `python -X utf8 _yayin-kesiti.py` yeniden üretir. Kimlik etiketleri tüzel kişilik kurulana dek
// yayın yer tutucusuyla geçer; e-posta kanalı kutu açılana dek yayımlanmaz (platform içi form). Belge A0N atıfları yayımlı rotalara bağlıdır.
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (çelişkide TR esastır). Aynı dizeler onam kaydına hash'lenir (ekran = hash, dil başına).
export const PERSONEL_TR = `## 1. Veri sorumlusu

[Belge A01](/aydinlatma) madde 1 tablosuyla aynı (**AURA platform işleticisi**, platform içi başvuru formu [/kvkk-basvuru](/kvkk-basvuru)).

---

## 2. Bu metin kimin için

AURA telesağlık platformunda **hasta dışı** bir rolle çalışan herkes: klinik aktivasyonu onaylanmış **Doktor (Aşama 2)**,
**Koordinatör**, **Etik Kurul üyesi**, **Yönetici**, **Sağlık Turizmi Acentesi** yetkilisi, **Partner Doktor** ve
**Sağlık Uzmanı** (doktor dışı sağlık profesyoneli). Rolünüze özgü erişim kapsamı madde 10'da yazılıdır ve onayladığınız
metnin parçasıdır.

---

## 3. İşlenen kişisel veriler

| Kategori | Veriler |
|---|---|
| Kimlik ve iletişim | Ad-soyad, e-posta, telefon *(şifreli)*, şehir/ülke, parola özeti; Google/Apple girişinde kimlik tanımlayıcısı |
| Mesleki bilgiler | Unvan, branş/meslek, çalıştığı kurum, tescil/lisans numarası, diller, deneyim yılı |
| Mesleki belgeler (Doktor) | Diploma — e-Devlet doğrulaması başarılıysa **dosya saklanmaz** (Doctorium Belge 11); mesleki sorumluluk sigortası, uzmanlık/sertifika, akademik belgeler — **şifreli**, üyelik süresince (Belge A06 madde 3.15b) |
| Kurumsal başvuru (Partner · Acente · Sağlık Uzmanı) | Başvuru formu yanıtları ve belgeleri — Belge A10 |
| Kamuya açık doktor profili | Ad, unvan, branş, kurum, diller, deneyim, kısa tanıtım, tanıtım videosu/avatarı, hasta değerlendirme puanı ve yorumlar — **\`/doktorlar\` dizininde ve hasta yüzünde görünür** (yalnız yönetim onayı \`verified\` sonrası) |
| Çalışma verileri (Doktor) | Aylık kapasite, müsaitlik, nöbet/icap tercihleri, ikinci görüş / sağlık turizmi / ücretsiz hizmet tercihleri, işlem kataloğu ve fiyatları, hakediş kayıtları *(bugün simülasyon)*, atanan vaka ve görüşme sayıları, eşleştirme kalite göstergeleri (ücretsiz hizmet sayısı, hasta memnuniyeti, icap dönüş oranı) |
| Hasta değerlendirmeleri | Hastaların doktor hakkındaki puan ve yorumları (\`Review\`) |
| Onay kayıtları | Bu aydınlatma, Doctorium onamları, diploma beyanı — hash + zincir + damga |
| İşlem güvenliği | Giriş kayıtları, IP, cihaz; **hasta verisine yaptığınız her erişim** değiştirilemeyen zincire yazılır ve hastaya gösterilir |

---

## 4. Amaçlar

1. Hesabın oluşturulması, davet/başvuru onayı ve yönetimi
2. Mesleki kimliğin doğrulanması ve klinik aktivasyon (Doktor); kurumsal başvurunun değerlendirilmesi
3. Hasta eşleştirmesi, nöbet/icap yönlendirmesi, kapasite planlaması; eşleştirmede kalite göstergelerinin kullanılması
4. Kamuya açık doktor profilinin yayımlanması (hastanın doktor seçimi)
5. Görüşme, ikinci görüş, takip ve rezervasyon süreçlerinin yürütülmesi; hakediş hesabı *(simülasyon)*
6. Etik Kurul süreçleri (başvuru, savunma, karar)
7. Erişim denetimi, güvenlik, hukuki yükümlülük, hasta haklarının (erişim kaydı) karşılanması

---

## 5. Hukuki sebepler

Sözleşmenin kurulması ve ifası (**m.5/2-c**) · hukuki yükümlülük (**m.5/2-ç**) · meşru menfaat — güvenlik ve erişim
denetimi (**m.5/2-f**) · kamuya açık profil: sözleşme + hastanın doktor seçebilmesine ilişkin meşru menfaat; yayımlanan alanlar
doktorun kontrolündedir (madde 9) · hasta yorumları: hastanın ifade özgürlüğü ve platformun meşru menfaati; yorum
itirazı madde 9. Mesleki belgelerde **özel nitelikli veri işlenmez** (sağlık verisi istenmez).

---

## 6. Aktarım

Kamuya açık profil verileri hastalara ve vitrin ziyaretçilerine; atanan vakaya ilişkin kimliğiniz hastaya; hizmet
sağlayıcılar [Belge A01](/aydinlatma) madde 7.2 ile aynı (Anthropic: doktorun kullandığı görüşme notu/epikriz taslağı için klinik
içerik gider, doktor kimliği gitmez; Google Gemini Live: görüşme sesi — hastanın rızası varsa doktorun sesi de akar).
Sağlık Turizmi Acentesi ayrı tüzel kişi olursa ilgili doktorun adı ve branşı rezervasyon dosyasında acenteye gider.

---

## 7. Saklama

Belge A06 madde 3.15 – 3.17: diploma dosyası saklanmaz; ihtiyari belgeler üyelik süresince şifreli; kurumsal
başvuru rette 90 gün; personel hesabı görev sonunda kapatılır, kişisel alanlar silinir; klinik kayıtlardaki eylem
izleri ve hasta verisine erişim kayıtları (2 yıl sonra IP/cihaz boşaltılır) zincirde kalır; onay kayıtları 10 yıl.

---

## 8. Haklarınız

KVKK m.11 hakları ([Belge A07](/kvkk-basvuru)). Hesap silme düğmesi personel ve doktorda **kapalıdır** (klinik kayıt sahipliği); talep
[Belge A07](/kvkk-basvuru) usulüyle iletilir. Doctorium katmanı için Doctorium "Hesabım".

---

## 9. Kamuya açık profil ve hasta yorumları hakkında

Doktor, profilinin yayımlanmasını istediği alanları profil ekranından yönetir (kapasite, tercihler, işlem listesi, tanıtım
metni); ad, unvan, branş ve doğrulanma rozeti profil yayında olduğu sürece görünür. Hasta yorumları doğrulanmış
görüşme sonrası alınır ve yorumda hasta adı görünmez; hakaret, kişisel veri veya gerçeğe aykırılık gerekçesiyle doktor
platform içi başvuru formu ([/kvkk-basvuru](/kvkk-basvuru)) üzerinden kaldırma talep edebilir; talep **5 gün** içinde incelenir ve sonucu bildirilir.

---

## 10. Rol maddeleri (onaylanan metnin parçasıdır — rolünüze ait madde ekranda gösterilir)

**10.1 Doktor — Aşama 2 klinik aktivasyon.** Klinik aktivasyonla birlikte **yalnız size atanan veya kabul ettiğiniz**
başvuruların (ön değerlendirme, görüşme, ikinci görüş, ameliyat sonrası takip) özel nitelikli sağlık verilerine
erişirsiniz; erişim vaka bazlıdır, her erişim kayıt zincirine yazılır ve hastaya gösterilir. Uzman havuzunda atanmamış
başvuruları yalnız **kimliksiz** önizlemeyle görürsünüz. Takip kapandığında o başvuruya erişiminiz sona erer. Hasta
verisini yalnız hizmet amacıyla işler, platform dışına kopyalamaz, görüşmeyi kaydetmez ve **mesleki sır saklama
yükümlülüğü** altında olduğunuzu kabul edersiniz. Verdiğiniz klinik görüş, düzenlediğiniz kayıt ve onayladığınız yapay
zekâ taslaklarının doğruluğundan ve mesleki/etik kurallara uygunluğundan **siz sorumlusunuz**; Platform tıbbi kararınıza
müdahale etmez. Doctorium üyeliğiniz ayrı kapsamda aydınlatılmıştır; iki kapsam birbirinden bağımsızdır.

**10.2 Koordinatör.** Süreç, lojistik ve rezervasyon bilgilerine erişirsiniz; **klinik kayıt içeriğine erişiminiz yoktur**
(ikinci görüş, görüşme notu, belgeler). Hasta kimlik ve iletişim bilgisini yalnız süreç yönetimi amacıyla işler, üçüncü
kişiyle paylaşmaz ve sır olarak saklarsınız.

**10.3 Etik Kurul üyesi.** Başvuruları **hasta kimliğini görmeden** (anonimleştirilmiş vaka ve operasyon verisiyle)
incelersiniz; savunma veren tarafın kimliği de size gösterilmez. Karar ve yaptırımlar gerekçeli yazılır; incelemede
edindiğiniz bilgileri sır olarak saklarsınız.

**10.4 Yönetici.** Yönetim paneli üzerinden üye/personel onayı, KVKK başvuruları, kampanya ve ödül yönetimine
erişirsiniz; klinik kayıt içeriğine **doğrudan erişiminiz yoktur** ve hesap silme kilidi sizin için de geçerlidir.
Panelde gördüğünüz kişisel verileri yalnız görev amacıyla işlersiniz (Belge 19 taahhütnamesi).

**10.5 Sağlık Turizmi Acentesi.** Tedavi dosyalarında hastanın **ad, ülke, dil, telefon, iletişim tercihi, hastane ve
tedavi süresi** bilgilerine ve sigorta **risk çarpanına** erişirsiniz; **tıbbi belge, sağlık beyanı ve klinik kayıt
görmezsiniz**. Bu bilgileri yalnız seyahat/konaklama/transfer organizasyonu amacıyla işler, üçüncü kişilerle (otel,
transfer firması) yalnız organizasyon için gerekli asgari ölçüde ve gizlilik yükümlülüğü altında paylaşır, sır olarak
saklarsınız. Ayrı tüzel kişilik olarak faaliyet gösteriyorsanız Belge A13 protokolü uygulanır.

**10.6 Partner Doktor.** Platformun hasta veritabanına **erişiminiz yoktur**; size iletilen sorularda kişi adları
maskelenir. Yönlendirdiğiniz hastaya ait bilgileri **anonimleştirerek** iletirsiniz ve bulunduğunuz ülkenin mesleki
mevzuatına uygunluktan sorumlusunuz. Konsültasyon yanıt ücreti bugün simülasyondur.

**10.7 Sağlık Uzmanı (doktor dışı sağlık profesyoneli).** Bu aşamada klinik vaka verilerine **erişiminiz bulunmaz**;
erişim kapsamı tanımlandığında ayrıca bilgilendirilir ve yeniden onayınız alınır.

---

## 11. Değişiklikler

Rolünüzün erişim kapsamı kodda değişirse ilgili rol maddesi değişir, sürüm artar ve **yeniden onay** alınır.
`;

export const PERSONEL_EN = `## 1. Data controller

Same as the table in [Document A01](/aydinlatma), Section 1 (**the AURA platform operator**, in-platform request form [/kvkk-basvuru](/kvkk-basvuru)).

---

## 2. Who this text is for

Everyone working on the AURA telehealth platform in a **non-patient** role: **Doctor (Stage 2)** whose clinical activation has been approved, **Coordinator**, **Ethics Board member**, **Administrator**, **Health Tourism Agency** officer, **Partner Doctor** and **Health Professional** (non-doctor health professional). The access scope specific to your role is set out in Section 10 and forms part of the text you approve.

---

## 3. Personal data processed

| Category | Data |
|---|---|
| Identity and contact | Name and surname, e-mail, telephone *(encrypted)*, city/country, password hash; identity identifier for Google/Apple sign-in |
| Professional information | Title, specialty/profession, institution, registration/licence number, languages, years of experience |
| Professional documents (Doctor) | Diploma — if e-Devlet verification succeeds, **the file is not retained** (Doctorium Document 11); professional liability insurance, specialty/certificate and academic documents — **encrypted**, for the duration of membership (Document A06, Section 3.15b) |
| Corporate application (Partner · Agency · Health Professional) | Application form answers and documents — Document A10 |
| Public doctor profile | Name, title, specialty, institution, languages, experience, short introduction, introductory video/avatar, patient rating and reviews — **visible in the \`/doktorlar\` directory and on the patient side** (only after administrative approval \`verified\`) |
| Working data (Doctor) | Monthly capacity, availability, on-duty/on-call preferences, second opinion / health tourism / free care preferences, procedure catalogue and prices, earnings records *(simulation today)*, numbers of assigned cases and consultations, matching quality indicators (number of free care services, patient satisfaction, on-call response rate) |
| Patient reviews | Patients' ratings and comments about the doctor (\`Review\`) |
| Consent records | This notice, Doctorium consents, diploma declaration — hash + chain + seal |
| Transaction security | Sign-in records, IP, device; **every access you make to patient data** is written to the immutable chain and shown to the patient |

---

## 4. Purposes

1. Creation of the account, approval and management of invitations/applications
2. Verification of professional identity and clinical activation (Doctor); evaluation of the corporate application
3. Patient matching, on-duty/on-call routing, capacity planning; use of quality indicators in matching
4. Publication of the public doctor profile (the patient's choice of doctor)
5. Conduct of consultation, second opinion, follow-up and booking processes; calculation of earnings *(simulation)*
6. Ethics Board processes (application, defence, decision)
7. Access control, security, legal obligations, fulfilment of patient rights (access record)

---

## 5. Legal grounds

Conclusion and performance of a contract (**Article 5/2-c**) · legal obligation (**Article 5/2-ç**) · legitimate interest — security and access control (**Article 5/2-f**) · public profile: contract + legitimate interest in enabling the patient to choose a doctor; the published fields are under the doctor's control (Section 9) · patient reviews: the patient's freedom of expression and the platform's legitimate interest; objection to a review, Section 9. **No special categories of data are processed** in professional documents (no health data are requested).

---

## 6. Transfers

Public profile data to patients and public site visitors; your identity in relation to an assigned case to the patient; service providers as in [Document A01](/aydinlatma), Section 7.2 (Anthropic: clinical content is sent for the draft consultation note/discharge summary used by the doctor, the doctor's identity is not sent; Google Gemini Live: consultation audio — if the patient has consented, the doctor's voice also flows). If the Health Tourism Agency becomes a separate legal entity, the name and specialty of the relevant doctor go to the agency in the booking file.

---

## 7. Retention

Document A06, Sections 3.15 – 3.17: the diploma file is not retained; optional documents encrypted for the duration of membership; corporate application, 90 days in case of refusal; the staff account is closed at the end of duty and personal fields are deleted; action traces in clinical records and records of access to patient data (IP/device cleared after 2 years) remain in the chain; consent records, 10 years.

---

## 8. Your rights

KVKK Article 11 rights ([Document A07](/kvkk-basvuru)). The account deletion button is **disabled** for staff and doctors (ownership of clinical records); requests are submitted under the procedure in [Document A07](/kvkk-basvuru). For the Doctorium layer, Doctorium "My Account".

---

## 9. About the public profile and patient reviews

The doctor manages, from the profile screen, the fields they wish to have published (capacity, preferences, procedure list, introductory text); name, title, specialty and the verification badge remain visible as long as the profile is published. Patient reviews are collected after a verified consultation and the patient's name does not appear in the review; the doctor may request removal via the in-platform request form ([/kvkk-basvuru](/kvkk-basvuru)) on grounds of insult, personal data or untruthfulness; the request is examined within **5 days** and the outcome is notified.

---

## 10. Role clauses (part of the approved text — the clause for your role is shown on screen)

**10.1 Doctor — Stage 2 clinical activation.** With clinical activation you access the special-category health data of **only those cases assigned to you or accepted by you** (preliminary assessment, consultation, second opinion, post-operative follow-up); access is case-based, every access is written to the record chain and shown to the patient. In the specialist pool you see unassigned cases only through a **de-identified** preview. When follow-up closes, your access to that case ends. You accept that you process patient data solely for the purpose of the service, do not copy it outside the platform, do not record the consultation and are bound by the **obligation of professional secrecy**. **You are responsible** for the accuracy of the clinical opinions you give, the records you draw up and the AI drafts you approve, and for their compliance with professional/ethical rules; the Platform does not interfere with your medical decision. Your Doctorium membership is covered by a separate notice; the two scopes are independent of each other.

**10.2 Coordinator.** You access process, logistics and booking information; **you have no access to clinical record content** (second opinion, consultation note, documents). You process patient identity and contact information solely for the purpose of process management, do not share it with third parties and keep it confidential.

**10.3 Ethics Board member.** You examine applications **without seeing the patient's identity** (with anonymised case and operational data); the identity of the party submitting a defence is not shown to you either. Decisions and sanctions are written with reasons; you keep the information obtained during the examination confidential.

**10.4 Administrator.** Through the administration panel you access member/staff approval, KVKK requests, campaign and reward management; **you have no direct access** to clinical record content, and the account deletion lock also applies to you. You process the personal data you see in the panel solely for the purpose of your duty (Document 19 undertaking).

**10.5 Health Tourism Agency.** In treatment files you access the patient's **name, country, language, telephone, contact preference, hospital and treatment duration** and the insurance **risk multiplier**; **you do not see medical documents, the health declaration or the clinical record**. You process this information solely for the organisation of travel/accommodation/transfer, share it with third parties (hotel, transfer company) only to the minimum extent necessary for the organisation and under a confidentiality obligation, and keep it confidential. If you operate as a separate legal entity, the Document A13 protocol applies.

**10.6 Partner Doctor.** **You have no access** to the Platform's patient database; personal names in the questions forwarded to you are masked. You forward information about the patient you refer **in anonymised form** and are responsible for compliance with the professional legislation of the country you are in. The consultation response fee is a simulation today.

**10.7 Health Professional (non-doctor health professional).** At this stage **you have no access** to clinical case data; when an access scope is defined, you will be informed separately and your approval obtained again.

---

## 11. Changes

If the access scope of your role changes in the code, the relevant role clause changes, the version is incremented and **re-approval** is obtained.
`;

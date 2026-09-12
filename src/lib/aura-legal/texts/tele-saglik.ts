// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/aura-hukuki-belgeler/teslim/md/A03-tele-saglik-hizmeti-bilgilendirmesi.md (TR) + en/A03-telehealth-service-information.md (EN) — Sürüm 1.0 · 12.09.2026 NİHAİ.
// Elle DÜZENLEME YOK: kaynak .md vault'ta; `python -X utf8 _yayin-kesiti.py` yeniden üretir. Kimlik etiketleri tüzel kişilik kurulana dek
// yayın yer tutucusuyla geçer; e-posta kanalı kutu açılana dek yayımlanmaz (platform içi form). Belge A0N atıfları yayımlı rotalara bağlıdır.
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (çelişkide TR esastır). Aynı dizeler kod Paket B'de onam kaydına hash'lenir.
export const TELE_SAGLIK_TR = `## 1. Bu bilgilendirme neden var

Uzaktan sağlık hizmeti almadan önce; hizmetin ne olduğunu, neyi kapsamadığını, hangi durumlarda uygun olmadığını,
görüşmenin nasıl işleyeceğini ve kayıtlarınızın nasıl tutulacağını bilmeniz gerekir. Bu metin, Aydınlatma Metni'ni
([Belge A01](/aydinlatma)) ve Kullanım Koşulları'nı ([Belge A02](/kosullar)) tamamlar; onların yerine geçmez.

---

## 2. Hizmeti kim sunar, AURA'nın rolü nedir

**2.1.** Uzaktan sağlık hizmeti, mesleki kimliği doğrulanmış **doktorlar** tarafından, **klinik hizmet sağlayıcı**
çatısı altında sunulur *(sağlayıcının kimliği ve yetki belgesi bilgisi yayından önce bu bölüme eklenecektir)*.

**2.2.** AURA; başvurunuzu düzenler, uygun uzmanlık alanını önerir, doktorla buluşturur, görüşmeyi ve süreci koordine
eder, kayıtlarınızı güvenle saklar ve paylaşmanızı sağlar. **AURA tanı koymaz, tedavi vermez, reçete düzenlemez.**

**2.3.** Doktorların diploması e-Devlet barkodlu mezun belgesiyle doğrulanır; mesleki sorumluluk sigortası, uzmanlık
belgesi ve akademik belgeler incelenir. AURA "akredite doktor" iddiasında bulunmaz; doğruladığı şey belgelerin varlığı
ve geçerliliğidir.

---

## 3. Uzaktan hizmetle neler yapılabilir, neler yapılamaz

| Yapılabilir | Yapılamaz / sınırlı |
|---|---|
| Şikâyetinizin ön değerlendirmesi ve uygun uzmanlık alanına yönlendirilmesi | **Fiziksel muayene**, girişimsel işlem, cihazla ölçüm gerektiren değerlendirmeler |
| Doktorla görüntülü/sesli danışma; mevcut belgelerinizin değerlendirilmesi | Görüşme kaydı — video ve ses **kaydedilmez** |
| Yazılı **ikinci görüş** (mevcut tanı/tedavi planı hakkında) | **E-reçete** — Platform üzerinden reçete düzenlenmez; ilaç ve işlem önerileri bilgilendirme niteliğindedir |
| Tedavi ve seyahat **planlamasının** koordinasyonu (sağlık turizmi) | Bağlayıcı fiyat teklifi ve rezervasyon — bugün simülasyon ([Belge A02](/kosullar) madde 6, Belge A08) |
| **Ameliyat sonrası takip**: günlük kontrol, fotoğraf, uyarı işaretlerinin doktora iletilmesi | **Acil müdahale** (madde 4) |
| Görüşme notu, epikriz ve laboratuvar sonuçlarının kaydınıza işlenmesi; kayıtlarınızı paylaşmanız | Rapor ve notların resmî sağlık kayıt sistemlerine (E-Nabız) iletilmesi — bugün yok |

Doktor, uzaktan değerlendirmenin yeterli olmadığına karar verirse sizi yüz yüze muayeneye veya acil servise
yönlendirir ve görüşmeyi bu gerekçeyle sonlandırabilir.

---

## 4. Acil durumlar

**AURA acil servis değildir.** Göğüs ağrısı, nefes darlığı, bilinç bulanıklığı/kaybı, ağır kanama, ani güçsüzlük veya
konuşma bozukluğu, ciddi yaralanma, intihar düşüncesi gibi durumlarda **derhâl 112'yi** (bulunduğunuz ülkenin acil
numarasını) arayın veya en yakın acil servise gidin. Ön değerlendirmede yüksek aciliyet saptanan başvurular nöbetçi
doktora yönlendirilir; bu, acil müdahale yerine geçmez ve zaman kaybettirmemelidir.

---

## 5. Görüşme sırasında

- **Kimlik:** görüşmeye kayıtlı hesabınızla katılırsınız; doktor sizinle kimin görüştüğünü bilir. Başkası adına
  görüşme yapılamaz ([Belge A02](/kosullar) madde 3.4 istisnası dışında).
- **Ortam:** görüşme için sessiz, özel bir ortam seçin; ekranınızı başkalarının görmediğinden emin olun.
- **Kayıt:** görüşme AURA tarafından kaydedilmez. Siz de doktorun bilgisi ve rızası olmadan görüşmeyi kaydedemezsiniz.
- **Tercüme:** görüşme dilleriniz farklıysa, açık rızanızla yapay zekâ tarafından simültane tercüme yapılabilir;
  tercümesiz devam etmeyi de seçebilirsiniz. Bu tercüme **nitelikli insan tercüman değildir**;
  tıbbi terimlerde hata payı olabilir. Anlaşılmayan noktayı doktora tekrar sorun; üretilen
  altyazı metni kaydınızda şifreli saklanır.
- **Bağlantı:** bağlantı koparsa görüşmeye yeniden katılabilirsiniz; doğrudan bağlantı kurulamadığında devreye giren
  röle sunucusu yalnız şifreli trafiği taşır.
- **Cihaz testi:** görüşmeden önce kamera, mikrofon ve hoparlör testi yapabilir, sormak istediklerinizi not alabilirsiniz.
- **Sonlandırma:** doktor, tıbbi gerekçeyle veya uygunsuz davranış hâlinde görüşmeyi sonlandırabilir.

---

## 6. Kayıtlar ve mahremiyet

Görüşme notu, epikriz, laboratuvar sonuçları, tanı ve işlem kodları ile takip kayıtları **sizin sağlık kaydınızdır**;
şifreli saklanır, yalnız size atanan doktor ve rolünün gerektirdiği ölçüde personel erişir; her erişim kaydedilir ve
size gösterilir. Ayrıntı: [Belge A01](/aydinlatma) madde 3, 7 ve 8. Kayıtlarınızı süreli ve şifreli bağlantıyla paylaşabilir, standart
biçimde dışa aktarabilirsiniz.

---

## 7. Yapay zekâ desteği

Ön değerlendirme, görüşme notu taslağı, epikriz taslağı, iyileşme fotoğrafı analizi ve çeviri yapay zekâ desteğiyle
yapılabilir. Her biri **ayrı açık rızanıza** bağlıdır ve **hiçbiri tıbbi karar üretmez**: uzmanlık önerisi ve aciliyet
sırası doktor ve operasyon tarafından değiştirilebilir; taslak not ve raporları doktor onaylar ve sorumluluk doktorundur.
Yapay zekâ ile ön değerlendirme başvurunun başlangıç adımıdır: bu rızayı vermezseniz başvuru oluşturulamaz ve
hizmeti almamayı seçmiş olursunuz; rıza her zaman özgürdür. Tercüme rızası yalnız görüşme dilleriniz
farklıysa sorulur; tercümesiz devam edebilirsiniz. Doktorun kullandığı diğer yapay zekâ araçları (görüşme notu ve
rapor taslağı, fotoğraf analizi) genel açık rızanız kapsamındadır; sizden ayrıca rıza istenmez, çıktıyı doktor onaylar.

---

## 8. Ücret

Görüşme, ikinci görüş ve paket ücretleri Platform'da gösterilir; **bugün tahsilat yapılmaz** (simülasyon). Gerçek
tahsilata geçildiğinde ücret, ödeme aracı, cayma ve iade koşulları hizmet öncesi ayrıca bildirilir ([Belge A02](/kosullar) madde 6).

---

## 9. Haklarınız

- **Bilgilendirilme ve rıza:** hizmetin niteliği, riskleri ve alternatifleri hakkında doktorunuzdan bilgi isteme; her
  işlem için rıza verme veya **reddetme** hakkı.
- **Tedaviyi reddetme ve görüşmeyi sonlandırma:** dilediğiniz an.
- **Mahremiyet:** kayıtlarınızın gizliliği; kimlerin eriştiğini görme.
- **Şikâyet:** hizmet süreciyle ilgili şikâyetinizi Platform içinden **Etik Kurul**'a iletme (anonim inceleme);
  platform içi başvuru formu ([/kvkk-basvuru](/kvkk-basvuru)); ilgili kamu makamlarına başvuru hakkınız saklıdır.
- **Kişisel verilerinize ilişkin haklar:** [Belge A01](/aydinlatma) madde 9 · [Belge A07](/kvkk-basvuru).

---

## 10. Yurt dışından katılan hastalar

Uzaktan sağlık hizmeti Türkiye'de yetkilendirilmiş doktorlar tarafından Türk mevzuatına göre sunulur; bulunduğunuz
ülkede uzaktan sağlık hizmeti alınmasına, ilaç teminine ve raporların geçerliliğine ilişkin kurallar farklı olabilir.
Acil durumda kendi ülkenizin acil numarasını arayın. Tercüme sınırı için madde 5.

---

## 11. Sürüm ve değişiklik

Bu bilgilendirme hizmetin işleyişi değiştikçe güncellenir; sürüm ve tarih belgenin başında yer alır. Türkçe metin
esastır; İngilizce çeviri ikinci kanonik metindir.
`;

export const TELE_SAGLIK_EN = `## 1. Why this information exists

Before receiving a remote health service, you need to know what the service is, what it does not cover, in which situations it is not suitable, how the consultation will work and how your records will be kept. This text complements the Privacy Notice ([Document A01](/aydinlatma)) and the Terms of Use ([Document A02](/kosullar)); it does not replace them.

---

## 2. Who provides the service and what AURA's role is

**2.1.** The remote health service is provided by **doctors** whose professional identity has been verified, under the umbrella of the **clinical service provider** *(the provider's identity and authorisation certificate details will be added to this section before publication)*.

**2.2.** AURA organises your case, suggests the appropriate specialty, connects you with the doctor, coordinates the consultation and the process, stores your records securely and enables you to share them. **AURA does not diagnose, does not treat and does not issue prescriptions.**

**2.3.** Doctors' diplomas are verified against the e-Devlet barcoded graduation certificate; professional liability insurance, specialty certificates and academic documents are reviewed. AURA makes no claim of "accredited doctors"; what it verifies is the existence and validity of the documents.

---

## 3. What can and cannot be done through the remote service

| Can be done | Cannot be done / limited |
|---|---|
| Preliminary assessment of your complaint and routing to the appropriate specialty | **Physical examination**, interventional procedures, assessments requiring measurement with a device |
| Video/audio consultation with a doctor; assessment of your existing documents | Recording of the consultation — video and audio are **not recorded** |
| A written **second opinion** (on an existing diagnosis/treatment plan) | **E-prescription** — no prescription is issued through the Platform; medication and procedure recommendations are for information |
| Coordination of treatment and travel **planning** (health tourism) | Binding price offers and bookings — currently a simulation ([Document A02](/kosullar), Section 6; Document A08) |
| **Post-operative follow-up**: daily check-ins, photos, forwarding of warning signs to the doctor | **Emergency intervention** (Section 4) |
| Entry of the consultation note, discharge summary and laboratory results into your record; sharing your records | Transmission of reports and notes to official health record systems (e-Nabız) — not available today |

If the doctor decides that a remote assessment is insufficient, they will refer you to a face-to-face examination or an emergency department and may end the consultation on that ground.

---

## 4. Emergencies

**AURA is not an emergency service.** In situations such as chest pain, shortness of breath, confusion or loss of consciousness, severe bleeding, sudden weakness or speech disturbance, serious injury or suicidal thoughts, **call 112 immediately** (or the emergency number of the country you are in) or go to the nearest emergency department. Cases found to be of high urgency in the preliminary assessment are routed to the on-duty doctor; this does not replace emergency care and must not cause delay.

---

## 5. During the consultation

- **Identity:** you join the consultation with your registered account; the doctor knows who they are consulting. Consultations on behalf of another person are not possible (except as provided in [Document A02](/kosullar), Section 3.4).
- **Environment:** choose a quiet, private setting for the consultation; make sure others cannot see your screen.
- **Recording:** the consultation is not recorded by AURA. You may not record the consultation either without the doctor's knowledge and consent.
- **Interpretation:** if the languages of the consultation differ, simultaneous interpretation by artificial intelligence may be provided with your explicit consent; you may also choose to continue without interpretation. This interpretation **is not a qualified human interpreter**; medical terms may contain errors. Ask the doctor again about anything unclear; the generated caption text is stored encrypted in your record.
- **Connection:** if the connection drops, you can rejoin the consultation; the relay server that takes over when a direct connection cannot be established carries only encrypted traffic.
- **Device test:** before the consultation you can test your camera, microphone and speaker and note the questions you want to ask.
- **Ending:** the doctor may end the consultation on medical grounds or in the event of inappropriate behaviour.

---

## 6. Records and privacy

The consultation note, discharge summary, laboratory results, diagnosis and procedure codes and follow-up records **are your health record**; they are stored encrypted, accessed only by the doctor assigned to you and by staff to the extent required by their role; every access is recorded and shown to you. Details: [Document A01](/aydinlatma), Sections 3, 7 and 8. You can share your records via a time-limited, encrypted link and export them in a standard format.

---

## 7. Artificial intelligence support

The preliminary assessment, draft consultation note, draft discharge summary, recovery photo analysis and translation may be carried out with AI support. Each is subject to your **separate explicit consent** and **none produces a medical decision**: the specialty suggestion and urgency ranking can be changed by the doctor and operations; the doctor approves draft notes and reports and bears the responsibility. AI-assisted preliminary assessment is the first step of a case: if you do not give this consent, a case cannot be created and you will have chosen not to receive the service; consent is always freely given. Consent for interpretation is asked only if the languages of the consultation differ; you may continue without interpretation. The other AI tools used by the doctor (draft consultation note and report, photo analysis) fall within your general explicit consent; no separate consent is requested from you, and the doctor approves the output.

---

## 8. Fees

Consultation, second opinion and package fees are shown on the Platform; **no charges are collected today** (simulation). When real payment collection begins, the fee, payment instrument, withdrawal and refund conditions will be notified separately before the service ([Document A02](/kosullar), Section 6).

---

## 9. Your rights

- **Information and consent:** the right to request information from your doctor about the nature, risks and alternatives of the service; the right to give or **refuse** consent for each procedure.
- **Refusing treatment and ending the consultation:** at any time.
- **Privacy:** confidentiality of your records; seeing who has accessed them.
- **Complaints:** submitting a complaint about the service process to the **Ethics Board** from within the Platform (anonymous review); the in-platform request form ([/kvkk-basvuru](/kvkk-basvuru)); your right to apply to the competent public authorities is reserved.
- **Rights relating to your personal data:** [Document A01](/aydinlatma), Section 9 · [Document A07](/kvkk-basvuru).

---

## 10. Patients joining from abroad

The remote health service is provided by doctors authorised in Türkiye in accordance with Turkish legislation; the rules on receiving remote health services, obtaining medication and the validity of reports may differ in the country you are in. In an emergency, call the emergency number of your own country. For the limits of interpretation, see Section 5.

---

## 11. Version and changes

This information is updated as the operation of the service changes; the version and date appear at the top of the document. The Turkish text is authoritative; the English translation is the second canonical text.
`;

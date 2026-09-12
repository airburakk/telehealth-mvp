// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/aura-hukuki-belgeler A04-acik-riza-metinleri-paketi.md + A04-explicit-consent-texts.md (teslim/md TR · en/ EN) — Sürüm 1.0 · 12.09.2026 NİHAİ.
// Elle DÜZENLEME YOK: kaynak .md vault'ta; `python -X utf8 _yayin-kesiti.py` yeniden üretir. Kimlik etiketleri tüzel kişilik kurulana dek
// yayın yer tutucusuyla geçer; e-posta kanalı kutu açılana dek yayımlanmaz (platform içi form). Belge A0N atıfları yayımlı rotalara bağlıdır.
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (çelişkide TR esastır). Aynı dizeler onam kaydına hash'lenir (ekran = hash, dil başına).
export const AI_TRIAGE_TR = `**Yapay Zekâ ile Ön Değerlendirme — Açık Rıza**

Birazdan vereceğiniz bilgiler yapay zekâ tarafından **yalnızca** sizi doğru uzmanlık alanındaki doktora yönlendirmek ve
başvurunuzun aciliyet sırasını belirlemek için analiz edilecektir; herhangi bir tanı, teşhis, tedavi ya da tıbbi karar
için kullanılmayacaktır. Uzmanlık önerisi ve aciliyet sırası doktor ve operasyon ekibi tarafından değiştirilebilir.

Sisteme eklediğiniz tıbbi belge, rapor, görüntüleme, tahlil, epikriz ve benzeri belgeler ise yapay zekâ tarafından
**yalnızca** doktorunuza anlaşılır dilde sunulmak üzere çevrilecektir.

Bu işlem için şikâyet metniniz ve belgelerinizin içeriği, Amerika Birleşik Devletleri'nde yerleşik yapay zekâ sağlayıcısı
**Anthropic**'e (Claude) iletilir; **adınız iletilmez** (yer tutucuyla değiştirilir). Sağlayıcı bu verileri yalnız
istek süresince işler; AURA'daki kaydınız şifreli saklanır ([Belge A01](/aydinlatma) madde 8).

Rızanızı vermezseniz ön değerlendirme formu açılmaz ve başvuru oluşturulamaz; hizmeti almamayı seçebilirsiniz. Rızanızı
dilediğiniz zaman Hesabım'dan geri alabilirsiniz; geri alma, o ana kadar yapılmış işlemi etkilemez.

☐ **Kişisel verilerimin, sağlık verilerim dâhil, yukarıda sayılan amaçlarla ve yurt dışındaki sağlayıcıya aktarılarak
yapay zekâ tarafından işlenmesine AÇIK RIZAM vardır.**
`;

export const AI_TRIAGE_EN = `**AI-Assisted Preliminary Assessment — Explicit Consent**

The information you are about to provide will be analysed by artificial intelligence **solely** to route you to a doctor in the correct specialty and to determine the urgency ranking of your case; it will not be used for any diagnosis, treatment or medical decision. The specialty suggestion and urgency ranking may be changed by the doctor and the operations team.

The medical documents, reports, imaging, test results, discharge summaries and similar documents you add to the system will be translated by artificial intelligence **solely** so that they can be presented to your doctor in a language they understand.

For this purpose, the text of your complaint and the content of your documents are transmitted to **Anthropic** (Claude), an artificial intelligence provider established in the United States of America; **your name is not transmitted** (it is replaced with a placeholder). The provider processes this data only for the duration of the request; your record at AURA is stored encrypted ([Document A01](/aydinlatma), Section 8).

If you do not give your consent, the preliminary assessment form does not open and a case cannot be created; you may choose not to receive the service. You may withdraw your consent at any time from My Account; withdrawal does not affect processing carried out until then.

☐ **I GIVE MY EXPLICIT CONSENT to the processing of my personal data, including my health data, by artificial intelligence for the purposes listed above and to its transfer to the provider abroad.**
`;

export const AI_INTERPRET_TR = `**Yapay Zekâ ile Simültane Tercüme — Açık Rıza**

Birazdan doktorunuzla yapacağınız görüşme, yapay zekâ tarafından **yalnızca** simültane tercüme yapmak için analiz
edilecektir. Görüşme sesi, Amerika Birleşik Devletleri'nde yerleşik **Google**'ın (Gemini) tercüme hizmetine **canlı**
olarak iletilir; ses kaydedilmez ve oturum durumu saklanmaz. Üretilen altyazı/tercüme metni, görüşme kaydınızın parçası
olarak AURA'da **şifreli** saklanır ([Belge A01](/aydinlatma) madde 8).

Yapay zekâ tercümesi **nitelikli insan tercüman değildir**; tıbbi terimlerde hata payı olabilir — anlaşılmayan noktayı
doktorunuza tekrar sorun.

Tercüme istemiyorsanız görüşmeye tercümesiz devam edebilirsiniz. Rızanızı dilediğiniz zaman geri alabilirsiniz; geri
alma o ana kadar yapılan tercümeyi etkilemez.

☐ **Kişisel verilerimin, görüşme sesim dâhil, yukarıda sayılan amaçla ve yurt dışındaki sağlayıcıya aktarılarak yapay
zekâ tarafından işlenmesine AÇIK RIZAM vardır.**
`;

export const AI_INTERPRET_EN = `**AI Simultaneous Interpretation — Explicit Consent**

The consultation you are about to have with your doctor will be analysed by artificial intelligence **solely** for simultaneous interpretation. The consultation audio is transmitted **live** to the interpretation service of **Google** (Gemini), established in the United States of America; the audio is not recorded and no session state is retained. The generated caption/translation text is stored **encrypted** at AURA as part of your consultation record ([Document A01](/aydinlatma), Section 8).

AI interpretation **is not a qualified human interpreter**; medical terms may contain errors — ask your doctor again about anything unclear.

If you do not want interpretation, you may continue the consultation without it. You may withdraw your consent at any time; withdrawal does not affect interpretation carried out until then.

☐ **I GIVE MY EXPLICIT CONSENT to the processing of my personal data, including my consultation audio, by artificial intelligence for the purpose stated above and to its transfer to the provider abroad.**
`;

export const HEALTH_DECLARATION_TR = `**Sigorta Sağlık Beyanı — Açık Rıza**

Tahmini sigorta primini hesaplayabilmek için kronik hastalık, düzenli ilaç kullanımı, sigara ve geçirilmiş büyük
ameliyat bilgilerinizi soruyoruz. Beyanınız **yalnızca** sigorta risk çarpanının hesaplanması için kullanılır; başvurunuza
bağlı olarak **şifreli** saklanır ve klinik kaydınızla aynı süre boyunca tutulur. Koordinatör, acente ve doktor beyanınızın
kendisini görmez; yalnız hesaplanan risk çarpanını görür. Bugün poliçe düzenlenmemektedir; gösterilen prim tahminidir,
bağlayıcı bedeli ve teminat şartlarını sigorta şirketi belirler. Gerçek sigorta akışı başladığında beyanınızın sigorta
şirketine aktarılması için ayrıca rızanız istenir.

Beyanınızı dilediğiniz zaman değiştirebilir veya silebilirsiniz.

☐ **Sağlık beyanımın yukarıda sayılan amaçla işlenmesine AÇIK RIZAM vardır.**
`;

export const HEALTH_DECLARATION_EN = `**Insurance Health Declaration — Explicit Consent**

To calculate the estimated insurance premium, we ask about chronic conditions, regular medication use, smoking and previous major surgery. Your declaration is used **solely** to calculate the insurance risk multiplier; it is stored **encrypted**, linked to your case, and kept for the same period as your clinical record. The coordinator, the agency and the doctor do not see the declaration itself; they see only the calculated risk multiplier. No policy is issued today; the premium shown is an estimate, and the binding price and coverage terms are set by the insurance company. When the real insurance flow begins, your consent will be requested separately for the transfer of your declaration to the insurance company.

You may change or delete your declaration at any time.

☐ **I GIVE MY EXPLICIT CONSENT to the processing of my health declaration for the purpose stated above.**
`;

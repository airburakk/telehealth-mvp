// [S1+S2+S3] Medikal Estetik rehberlerinin AURA başvuru akışı; 20.09.2026.
import type { Guide } from "./guides";
const DETAILS: Record<string, {intro: Guide["intro"]; start: Guide["sections"][number]; end: Guide["sections"][number]}> = {
  "aesthetic-surgery": {
    "intro": {
      "tr": "AURA’da Estetik Cerrahi başvurusu, değiştirmek istediğiniz görünümü ve beklentilerinizi anlatmanızla başlar. Önce bir branş doktoruyla görüşebilir veya tedavi talebi oluşturabilirsiniz. İşlem seçimi, uygunluk ve seyahat planı doktor değerlendirmesinin ardından ele alınır.",
      "en": "An Aesthetic Surgery enquiry with AURA starts with the change you are considering and your expectations. Begin with a specialist consultation or a treatment request. Procedure choice, suitability and travel planning follow clinical assessment."
    },
    "start": {
      "title": {
        "tr": "AURA’da Estetik Cerrahi için nasıl başvurulur?",
        "en": "How to begin an Aesthetic Surgery enquiry with AURA"
      },
      "body": {
        "tr": "Medikal Estetik sayfasındaki değerlendirme bağlantısı sizi AURA’nın ortak tedavi talep formuna götürür. Burada hedefinizi, ülkenizi ve iletişim tercihlerinizi belirtirsiniz. Yapay zekâ destekli branş önerisini inceleyebilir ve Estetik Cerrahi alanını seçebilirsiniz. Talebiniz seçilen branşın doktor havuzuna iletilir; doktorlar yazılı mesaj veya video görüşme önerisi gönderebilir. Hangi işlemden yarar görebileceğiniz henüz net değilse önce branş doktoru görüşmesiyle de başlayabilirsiniz. Bir işlem adını forma yazmanız o işlemin sizin için uygun bulunduğu anlamına gelmez.",
        "en": "The assessment link on the Medical Aesthetics page opens AURA’s shared treatment request form. Describe your goal, country and contact preferences. Review the AI-assisted specialty suggestion and select Aesthetic Surgery where relevant. The request goes to the selected specialty’s doctor pool, where doctors can send a message or propose a video consultation. If you are unsure about a procedure, you can begin with a specialist consultation instead. Naming a procedure in the form does not establish its suitability for you."
      }
    },
    "end": {
      "title": {
        "tr": "Doktor değerlendirmesinden kişisel teklife",
        "en": "From clinical assessment to an individual proposal"
      },
      "body": {
        "tr": "Görüşmede hedefinizin yanında önceki işlemleri, sağlık bilgilerinizi ve karar vermeden önce yanıtlanmasını istediğiniz soruları paylaşın. Uygun görülürse doktor önerilen işlemleri, bedelleri, öngörülen tedavi süresini ve hastane bilgisini dosyaya kaydedebilir. Seyahat planlamasına geçildiğinde dosya acenteye iletilir; konaklama ve transfer gibi kalemler teklifte ayrıca şekillenir. İşlem kapsamı, kontroller ve dönüş sonrası iletişim planını inceleyin. AURA koordinasyonu platform içindeki süreçleri kapsar; başvurunuz bir ameliyat veya sonuç garantisi değildir.",
        "en": "Discuss your goals, previous procedures, health information and unanswered questions. Where appropriate, the doctor can record recommended procedures, prices, estimated treatment duration and hospital details. If travel planning proceeds, the file is referred to the agency for items such as accommodation and transfers. Review the procedure scope, check-ups and arrangements for contact after returning home. AURA coordinates processes within the platform; an enquiry does not guarantee surgery or its outcome."
      }
    }
  },
  "dental-aesthetics": {
    "intro": {
      "tr": "AURA’da Diş Estetiği için ilk adım, gülüşünüzle ilgili beklentinizi ve mevcut diş sorunlarınızı birlikte anlatmaktır. Diş Tedavisi branşı üzerinden değerlendirme isteyebilir; seçenekleri ve olası ziyaret ihtiyacını doktorla görüştükten sonra planlama aşamasına geçebilirsiniz.",
      "en": "For Dental Aesthetics with AURA, start by describing both your goals for your smile and any existing dental concerns. Request assessment through the Dental Treatment specialty, then discuss options and potential visits with the clinician before moving to planning."
    },
    "start": {
      "title": {
        "tr": "AURA’da Diş Tedavisi branşına ulaşmak",
        "en": "Reaching the Dental Treatment specialty through AURA"
      },
      "body": {
        "tr": "Medikal Estetik başvuru bağlantısından ortak tedavi talebi formunu açın. Beyazlatma, kaplama veya eksik diş gibi değerlendirmek istediğiniz konuyu kendi sözlerinizle anlatın. Önerilen branşı kontrol ederek Diş Tedavisi seçimini yapabilirsiniz. Talep ilgili doktor havuzuna gider; gelen mesaj ve video görüşme önerilerini hesabınızdan takip edersiniz. Önce seçenekleri anlamak istiyorsanız branş doktoru başvurusuyla başlayabilirsiniz. Mevcut rapor ve görüntülerinizin hangi belgelerle tamamlanması gerektiğini ilgili doktorla netleştirin; gereklilikleri yalnızca görsel bir beklentiye göre belirlemeyin.",
        "en": "Open the shared treatment request form from Medical Aesthetics and describe the issue you want assessed, such as whitening, veneers or missing teeth. Check the suggested specialty and select Dental Treatment where appropriate. The request goes to the relevant doctor pool; follow messages and video proposals in your account. If you first want to understand the options, start with a specialist consultation. Clarify which records or images the clinician needs rather than determining requirements solely from your desired appearance."
      }
    },
    "end": {
      "title": {
        "tr": "Tedavi aşamalarını seyahat planıyla birlikte netleştirmek",
        "en": "Clarifying treatment stages alongside travel planning"
      },
      "body": {
        "tr": "Doktorun önerdiği işlemleri, tedavi süresini ve kontrol ihtiyacını anladıktan sonra teklifi değerlendirin. Birden fazla ziyaret söz konusuysa her ziyaretin kapsamını ve konaklama ihtiyacını ayrıca sorun. AURA’da doktorun kaydettiği tedavi bilgileri, dosya iletildiğinde acentenin teklifine temel olur. Toplam bedelin yanında hangi işlemlerin, konaklama ve transferlerin dahil olduğunu inceleyin. İlk talep ödeme veya rezervasyon oluşturmaz; ekranda sunulan planın sağlayıcıyla teyidini ayrıca netleştirin. Kararınız, sizin için hazırlanmış değerlendirme ve açıklanmış koşullara dayanmalıdır.",
        "en": "Understand the proposed procedures, treatment duration and check-ups before considering the proposal. If multiple visits are discussed, ask what each includes and what accommodation is needed. Once referred, the doctor’s recorded treatment details inform the agency’s proposal in AURA. Review included procedures, accommodation and transfers alongside the total. The initial request creates no payment or reservation; clarify provider confirmation separately. Base your decision on your individual assessment and explained conditions."
      }
    }
  },
  "hair-transplant": {
    "intro": {
      "tr": "AURA’da Saç Ekimi başvurusu, saç dökülmesiyle ilgili ihtiyacınızı ve beklentinizi anlatmanızla başlar. Branş önerisini inceleyip doktor değerlendirmesi isteyebilirsiniz. Yöntem, işlem kapsamı ve seyahat ayrıntıları sizin için yapılan değerlendirme sonrasında netleşir.",
      "en": "A Hair Transplant enquiry with AURA begins with your hair-loss concern and expectations. Review the specialty suggestion and request a doctor assessment. Technique, procedure scope and travel details are clarified through your individual assessment."
    },
    "start": {
      "title": {
        "tr": "AURA’da Saç Ekimi talebi oluşturmak",
        "en": "Submitting a Hair Transplant enquiry with AURA"
      },
      "body": {
        "tr": "Ortak tedavi talep formunda saç dökülmesiyle ilgili hedefinizi ve paylaşmanız istenen bilgileri belirtin. Yapay zekânın branş önerisini kontrol edebilir, Saç Ekimi alanını seçebilirsiniz. Talebiniz ilgili branşın doktor havuzuna iletilir; doktorun mesaj veya video görüşme önerisini hesabınızda görürsünüz. Dökülmenin değerlendirilmesiyle başlamak istiyorsanız önce branş doktoruyla görüşme yolunu kullanabilirsiniz. Yapay zekâ önerisi yalnız yönlendirmeye yardımcı olur; ekime uygunluk, yöntem veya greft sayısı konusunda kişisel bir karar vermez.",
        "en": "Describe your hair-loss goals and the requested information in the shared treatment enquiry form. Review the AI suggestion and choose Hair Transplant where relevant. Your request goes to the specialty’s doctor pool, and you can view messages or video proposals in your account. If you want to begin by assessing hair loss, use the specialist consultation route. The AI suggestion supports routing; it does not decide your suitability, technique or graft count."
      }
    },
    "end": {
      "title": {
        "tr": "İşlem kapsamını ve takip sorumluluğunu konuşmak",
        "en": "Discussing procedure scope and follow-up responsibilities"
      },
      "body": {
        "tr": "Görüşmede yalnız greft sayısını veya paket fiyatını değil, değerlendirmeyi kimin yapacağını, işlemin kapsamını ve kontrolleri de sorun. Doktor değerlendirmesi ardından planlama ilerlerse işlem ve süre bilgileri dosyaya kaydedilebilir ve acenteye iletilebilir. Teklifte konaklama, transfer ve diğer hizmetleri ayrı ayrı inceleyin; dönüş sonrası sorularınızı hangi ekip ve kanal üzerinden ileteceğinizi netleştirin. AURA’daki başvuru ve teklif süreci saç ekimi yapılacağı veya belirli bir sonuç elde edileceği garantisi oluşturmaz. Karar vermeden önce kişisel planınızın açık olduğundan emin olun.",
        "en": "Ask who assesses you, what the procedure includes and how check-ups work, alongside graft count and package price. If planning proceeds after assessment, procedure and duration details can be recorded and referred to the agency. Review accommodation, transfers and other services individually and clarify how to contact the responsible team after returning home. The AURA enquiry and proposal process does not guarantee transplantation or a particular outcome. Make sure your individual plan is clear before deciding."
      }
    }
  },
  "injectable-treatments": {
    "intro": {
      "tr": "AURA’da enjeksiyon uygulamaları için başvururken önce ulaşmak istediğiniz sonucu anlatırsınız. İlgili branşla görüşme; ürün, uygulama alanı ve uygunluğun klinisyen tarafından değerlendirilmesine hazırlık sağlar. Bu sayfa üzerinden hazır bir enjeksiyon paketi satın alınmaz.",
      "en": "For an injectable-treatment enquiry with AURA, begin by describing your goals. Contact with the relevant specialty prepares for clinical assessment of the product, treatment area and suitability. This page does not sell a ready-made injection package."
    },
    "start": {
      "title": {
        "tr": "AURA’da beklentinizi ilgili branşa iletmek",
        "en": "Sharing your goals with a relevant specialty through AURA"
      },
      "body": {
        "tr": "Değerlendirme bağlantısı AURA’nın ortak tedavi talep formunu açar. Hedefinizi ve önceki uygulamalarla ilgili bilgileri anlatın; önerilen branşı inceleyip gerekirse değiştirin. Estetik Cerrahi ve Dermatoloji, başvuru formunda yer alan alanlar arasındadır; sizin ihtiyacınız için hangi değerlendirmenin gerektiği klinisyenle netleşir. Doktor mesajlarını ve video görüşme önerilerini hesabınızdan takip edin. Ürün veya doz seçimi yapay zekâ branş önerisinin görevi değildir. Karar öncesinde yalnız seçenekleri konuşmak istiyorsanız branş doktoru görüşmesiyle başlayabilirsiniz.",
        "en": "The assessment link opens AURA’s shared treatment request form. Describe your goals and previous treatments, then review or change the suggested specialty. Aesthetic Surgery and Dermatology are among the available areas; the assessment needed for your concern is clarified with a clinician. Follow doctor messages and video proposals in your account. Choosing a product or dose is not the role of AI specialty suggestions. You can also start with a specialist consultation to discuss options before deciding."
      }
    },
    "end": {
      "title": {
        "tr": "Uygulama kararı ile teklif kararını ayırmak",
        "en": "Distinguishing clinical decisions from proposal decisions"
      },
      "body": {
        "tr": "Bir görüşme önerisini kabul etmek, bir enjeksiyon uygulamasına onay vermek değildir. Kişisel uygunluğu, uygulayıcıyı, kullanılacak ürünü ve takip düzenini ilgili klinisyenle konuşun. Tedavi ve seyahat planı oluşturulacaksa doktorun değerlendirmesi sonrasında dosya acente teklifine ilerleyebilir. Hizmet kapsamını ve dahil olmayan kalemleri inceleyin. İlk talep sırasında ödeme veya rezervasyon yapılmaz; teklifin kabulü de Sağlık Turizmi kulvarında ödeme tahsilatı değildir. AURA, uygulamanın klinik değerlendirmesini yapan doktor veya sağlık kuruluşunun yerine geçmez.",
        "en": "Accepting a consultation proposal is not consent to an injection procedure. Discuss individual suitability, the practitioner, product and follow-up arrangements with the clinician. If treatment and travel are to be planned, the file can proceed to an agency proposal after clinical assessment. Review the scope and exclusions. There is no payment or reservation at initial request, and accepting a Medical Tourism proposal does not collect payment. AURA does not replace the clinician or healthcare provider responsible for clinical assessment."
      }
    }
  },
  "skin-and-laser": {
    "intro": {
      "tr": "AURA’da cilt ve lazer uygulamalarına ilişkin değerlendirme, cildinizle ilgili sorunu veya hedefinizi anlatmanızla başlar. Branş seçimini kontrol eder, ilgili doktorla seçenekleri konuşursunuz. İşlem ve seyahat planı, kişisel değerlendirmeden sonra ele alınır.",
      "en": "Assessment of skin and laser treatments with AURA starts with your concern or goal. Review the specialty selection and discuss options with the relevant doctor. Procedure and travel planning follow individual assessment."
    },
    "start": {
      "title": {
        "tr": "AURA’da cilt değerlendirmesine nasıl başlanır?",
        "en": "How to begin a skin assessment with AURA"
      },
      "body": {
        "tr": "Önce doktorla görüşme seçeneğinden veya ortak tedavi talebi formundan ilerleyebilirsiniz. İhtiyacınızı yazdığınızda yapay zekâ branş önerisine yardımcı olur; Dermatoloji dahil sunulan alanlar arasından seçiminizi kontrol edip değiştirebilirsiniz. Talep ilgili doktor havuzuna iletilir. Gelen mesaj veya video görüşme önerisini hesabınızdan izleyin. Hangi uygulamanın uygun olacağı yalnızca bu formdan belirlenmez; doktor ek bilgi veya yüz yüze değerlendirme ihtiyacını sizinle konuşabilir. Kullanılan cihazın adı kadar değerlendirmeyi ve uygulamayı kimin yapacağı da görüşmede netleşmelidir.",
        "en": "Begin with a doctor consultation or the shared treatment request form. AI helps suggest a specialty from your description; review or change the selection from available areas, including Dermatology. The request reaches the relevant doctor pool. Follow messages or video proposals in your account. The form alone does not determine the appropriate procedure; the doctor may discuss further information or in-person assessment. Clarify who assesses and treats you, alongside any device being considered."
      }
    },
    "end": {
      "title": {
        "tr": "Seans ve seyahat planını birlikte değerlendirmek",
        "en": "Considering session and travel plans together"
      },
      "body": {
        "tr": "Doktorunuzla önerilen uygulamayı, kontrol ihtiyacını ve varsa birden fazla ziyaret planını konuşun. AURA’da tedavi bilgileri kaydedilip acenteye iletildiğinde seyahat hizmetlerini içeren teklif hazırlanabilir. Seans veya ziyaret kapsamını, konaklama tarihlerini ve değişiklik koşullarını ayrı ayrı sorun. Bu rehberdeki genel yöntem bilgileri, sizin için bir cihaz ya da işlem önerisi değildir. Kararınızdan önce klinik plan ile teklifin birbiriyle uyumlu olduğunu teyit edin; platform dışı anlaşmalar AURA’nın koordinasyon kapsamına dahil değildir.",
        "en": "Discuss the proposed treatment, check-ups and any need for multiple visits with your doctor. Once treatment details are recorded and referred to the agency in AURA, a proposal can include travel services. Ask separately about sessions, visits, accommodation dates and change conditions. The general information here is not a device or procedure recommendation for you. Before deciding, confirm that the clinical plan and proposal align; arrangements outside the platform fall outside AURA’s coordination scope."
      }
    }
  },
  "before-you-decide": {
    "intro": {
      "tr": "AURA’da Medikal Estetik yolculuğunuz bir işlem satın almakla değil, beklentinizi açıklamak ve seçenekleri anlamakla başlar. Önce doktor görüşmesi veya doğrudan değerlendirme talebiyle ilerleyebilirsiniz. Aşağıdaki rehber, başvurudan kişisel kararınıza kadar AURA’daki adımları açıklar.",
      "en": "Your Medical Aesthetics journey with AURA begins with explaining expectations and understanding options, before purchasing a procedure. Start with a doctor consultation or a direct assessment request. This guide explains the steps from enquiry to your individual decision."
    },
    "start": {
      "title": {
        "tr": "İki başlangıç yolu, size ait bir karar",
        "en": "Two ways to begin, your own decision"
      },
      "body": {
        "tr": "Hangi yaklaşımın uygun olabileceğinden emin değilseniz önce branş doktoru görüşmesiyle başlayın. Belirli bir hedef için tedavi seçeneklerini ve teklifi değerlendirmek istiyorsanız Medikal Estetik başvuru bağlantısını kullanın; bu bağlantı ortak Sağlık Turizmi talep formunu açar. Her iki yolda ihtiyacınızı anlatır ve branş önerisini kontrol edersiniz. Yapay zekâ yönlendirmeye yardımcı olur, tanı veya işlem kararı vermez. Branş doktoru görüşmesinin ücret ve koşulları kendi ekranındadır; doğrudan tedavi talebinin ilk adımında ödeme veya rezervasyon yapılmaz.",
        "en": "If you are unsure which approach may suit you, start with a specialist consultation. To explore treatment options and a proposal for a particular goal, use the Medical Aesthetics application link, which opens the shared Medical Tourism request form. In either route, describe your needs and review the suggested specialty. AI supports routing, not diagnosis or procedure decisions. Specialist consultations have their own fees and conditions shown in their flow; the initial direct treatment request makes no payment or reservation."
      }
    },
    "end": {
      "title": {
        "tr": "AURA’da değerlendirmeden teklif kararına",
        "en": "From assessment to a proposal decision in AURA"
      },
      "body": {
        "tr": "Doğrudan talebiniz ilgili branşın doktor havuzuna gider. Doktor yazılı mesaj veya video görüşme önerisi gönderebilir; görüşme önerisini kabul ederseniz randevu onaylanır. Klinik değerlendirmeden sonra uygun bulunan tedavi, süre ve hastane bilgileri dosyaya kaydedilebilir. Dosya acenteye iletildiğinde seyahat kalemlerini içeren teklif hazırlanır. Teklifi kabul etmeden önce doktoru, hizmet kapsamını, dahil olmayan bedelleri ve dönüş sonrası iletişimi netleştirin. Sağlık Turizmi teklif onayı ödeme tahsilatı değildir ve ekrandaki plan kesinleşmiş rezervasyon anlamına gelmez. Devam etmemek de sizin kararınızdır.",
        "en": "Your direct request goes to the relevant specialty’s doctor pool. A doctor can send a message or propose a video consultation; accepting the latter confirms the appointment. Following clinical assessment, appropriate treatment, duration and hospital details can be recorded. Referral to the agency enables a proposal with travel items. Before accepting, clarify the clinician, service scope, excluded costs and contact after returning home. Accepting a Medical Tourism proposal does not collect payment, and the on-screen plan is not a confirmed reservation. Choosing not to proceed remains your decision."
      }
    }
  }
};
export function withAestheticsJourney(slug: string, guide: Guide): Guide {
  const detail = DETAILS[slug];
  if (!detail) return guide;
  return { ...guide, intro: detail.intro, sections: [detail.start, ...guide.sections, detail.end] };
}

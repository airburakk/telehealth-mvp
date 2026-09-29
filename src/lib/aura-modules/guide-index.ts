import type { ModuleKey } from "./catalog";
import type { Lang } from "@/lib/aura-landing/i18n";

export type LocalText = { tr: string; en: string };
export const text = (tr: string, en: string): LocalText => ({ tr, en });
export const readText = (value: LocalText, lang: Lang) => value[lang === "tr" ? "tr" : "en"];
export const GUIDE_INDEX = [
  { module: "second-opinion", slug: "what-is-a-second-opinion", title: text("İkinci Görüş nedir?", "What is a second opinion?"), summary: text("Hangi durumlarda düşünülür, ne sağlar ve sınırları nelerdir?", "When to consider it, what it offers and its limits.") },
  { module: "second-opinion", slug: "how-it-works", title: text("Nasıl işler?", "How does it work?"), summary: text("Tıbbi dosyanın hazırlanmasından uzman görüşünü değerlendirmeye.", "From preparing your records to discussing the specialist’s opinion.") },
  { module: "second-opinion", slug: "global-examples", title: text("Dünyadaki örnekler", "Global examples"), summary: text("Cleveland Clinic ve Stanford’un İkinci Görüş yaklaşımları.", "How Cleveland Clinic and Stanford approach second opinions.") },
  { module: "medical-tourism", slug: "healthcare-in-turkiye", title: text("Türkiye’de Sağlık Turizmi", "Healthcare in Türkiye"), summary: text("Tedavi alanları, resmî portallar ve kurum seçimi.", "Treatment areas, official portals and choosing a provider.") },
  { module: "medical-tourism", slug: "facts-and-figures", title: text("Türkiye: resmî veriler", "Türkiye: official figures"), summary: text("Hasta, hastane ve doktor sayıları; tarihleri ve kapsamlarıyla.", "Visitor, hospital and physician figures with dates and definitions.") },
  { module: "medical-tourism", slug: "planning-your-journey", title: text("AURA’da Sağlık Turizmi", "Medical Tourism with AURA"), summary: text("İki başlangıç yolu: önce doktor görüşmesi veya doğrudan talep; ardından değerlendirme ve teklif.", "Two ways to begin: consultation first or direct request, followed by assessment and a proposal.") },
  { module: "medical-aesthetics", slug: "aesthetic-surgery", title: text("Estetik cerrahi", "Aesthetic surgery"), summary: text("Yüz, burun, meme ve vücut cerrahisinde temel başlıklar.", "An introduction to face, nose, breast and body surgery.") },
  { module: "medical-aesthetics", slug: "facial-aesthetics", title: text("Yüz Estetiği", "Facial aesthetics"), summary: text("Yüz ve boyun germe, göz kapağı, kaş bölgesi ve kişisel değerlendirme.", "Face and neck lifting, eyelids, brows and individual assessment.") },
  { module: "medical-aesthetics", slug: "rhinoplasty", title: text("Burun Cerrahisi", "Rhinoplasty"), summary: text("Görünüm ve solunum, açık ve kapalı yaklaşım, revizyon ve takip.", "Appearance and breathing, open and closed approaches, revision and follow-up.") },
  { module: "medical-aesthetics", slug: "breast-surgery", title: text("Meme Cerrahisi", "Breast surgery"), summary: text("Büyütme, küçültme, dikleştirme, implant kararı ve uzun vadeli takip.", "Augmentation, reduction, lifting, implant decisions and long-term follow-up.") },
  { module: "medical-aesthetics", slug: "body-contouring", title: text("Vücut Şekillendirme", "Body contouring"), summary: text("Liposuction, karın germe, kol ve uyluk cerrahisi, aşamalı planlama.", "Liposuction, abdominoplasty, arm and thigh surgery, and staged planning.") },
  { module: "medical-aesthetics", slug: "dental-aesthetics", title: text("Diş estetiği", "Dental aesthetics"), summary: text("Beyazlatma, kaplama, ortodonti ve eksik dişlerin değerlendirilmesi.", "Whitening, veneers, orthodontics and assessing missing teeth.") },
  { module: "medical-aesthetics", slug: "hair-transplant", title: text("Saç ekimi", "Hair transplantation"), summary: text("Saç dökülmesinin değerlendirilmesi, yöntemler ve iyileşme.", "Assessing hair loss, understanding techniques and recovery.") },
  { module: "medical-aesthetics", slug: "injectable-treatments", title: text("Enjeksiyon uygulamaları", "Injectable treatments"), summary: text("Botulinum toksini ve dolgu arasındaki farklar.", "The differences between botulinum toxin and dermal fillers.") },
  { module: "medical-aesthetics", slug: "skin-and-laser", title: text("Cilt ve lazer uygulamaları", "Skin and laser treatments"), summary: text("Cilt yenileme, peeling, lazer ve enerji temelli uygulamalar.", "Skin resurfacing, peels, lasers and energy-based treatments.") },
  { module: "medical-aesthetics", slug: "before-you-decide", title: text("AURA’da karar süreci", "Deciding with AURA"), summary: text("Başvuru, branş seçimi, doktor görüşmesi ve kişisel teklifinizi değerlendirmek.", "Your enquiry, specialty selection, doctor consultation and individual proposal.") },
] satisfies { module: ModuleKey; slug: string; title: LocalText; summary: LocalText }[];
export const guidesFor = (module: ModuleKey) => GUIDE_INDEX.filter(item => item.module === module);
export const guidePath = (module: ModuleKey, slug: string) => `/care/${module}/${slug}`;
export function moduleSlogan(lang: Lang, module: ModuleKey) {
  const slogans: Record<Lang, [string, string, string]> = {
    tr: ["Sağlığınız için bir bakış açısı daha.", "Sağlığa uzanan yolculuğunuzda yanınızda.", "Size ait bir karar. Size özel bir yaklaşım."],
    en: ["Another perspective on your health.", "By your side on your journey to care.", "Your decision. A personal approach."],
    de: ["Eine weitere Perspektive auf Ihre Gesundheit.", "An Ihrer Seite auf dem Weg zur Behandlung.", "Ihre Entscheidung. Ein persönlicher Ansatz."],
    fr: ["Un autre regard sur votre santé.", "À vos côtés dans votre parcours de soins.", "Votre décision. Une approche personnelle."],
    ru: ["Ещё один взгляд на ваше здоровье.", "Рядом с вами на пути к лечению.", "Ваше решение. Индивидуальный подход."],
    ar: ["وجهة نظر أخرى حول صحتك.", "إلى جانبك في رحلتك للعلاج.", "قرارك أنت. ونهج يناسبك."],
    fa: ["نگاهی دیگر به سلامت شما.", "در مسیر درمان در کنار شما.", "تصمیم شما. رویکردی متناسب با شما."],
    az: ["Sağlamlığınıza daha bir baxış.", "Müalicə yolunda yanınızdayıq.", "Sizin qərarınız. Sizə özəl yanaşma."],
    bg: ["Още една гледна точка за вашето здраве.", "До вас по пътя към лечението.", "Вашето решение. Личен подход."],
  };
  return slogans[lang][["second-opinion", "medical-tourism", "medical-aesthetics"].indexOf(module)];
}

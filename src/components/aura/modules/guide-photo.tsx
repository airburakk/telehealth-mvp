import { aiNoticeText } from "@/components/AiVideoNotice";
import Image from "next/image";
import type { ModuleKey } from "@/lib/aura-modules/catalog";
import { readText, text } from "@/lib/aura-modules/guide-index";
import type { Lang } from "@/lib/aura-landing/i18n";
import styles from "./module-landing.module.css";

// [S1] Onaylanan seçkiler aynen korunur; her kare bağımsız bir fotoğraf penceresinde gösterilir.
// Aynı modülün kareleri ortak dosyayı kullanır; tarayıcı önbelleği tekrar indirmeyi önler.
const PHOTOS = {
  "second-opinion": {
    src: "/assets/modules/guides/second-opinion-approved.webp", tileRatio: 1,
    alts: [
      text("Hasta ile uzmanın sakin bir ortamda görüşmesi", "A patient discussing care with a specialist"),
      text("Uzmanın tıbbi dosyaları incelemesi", "A clinician reviewing medical records"),
      text("İki uzmanın bir değerlendirmeyi birlikte ele alması", "Two specialists discussing an assessment"),
      text("Görüşmeye hazırlık için dosya, not defteri ve gözlük", "A folder, notebook and glasses for consultation preparation"),
      text("Hasta ve doktorun dizüstü bilgisayar yanında görüşmesi", "A patient and clinician talking beside a laptop"),
      text("Bir çiftin görüşme öncesinde sorularını hazırlaması", "A couple preparing questions before a consultation"),
    ],
  },
  "medical-tourism": {
    src: "/assets/modules/guides/medical-tourism-approved.webp", tileRatio: 4 / 3,
    alts: [
      text("İstanbul silüetini ve vapuru betimleyen temsili sahne", "An illustrative scene of Istanbul’s skyline and a ferry"),
      text("Gün ışığı alan temsili bir sağlık kuruluşunun giriş alanı", "A sunlit entrance area in an illustrative healthcare facility"),
      text("Hasta ve yakınının bir koordinatörle seyahat planını konuşması", "A patient and companion discussing travel arrangements with a coordinator"),
      text("Seyahat öncesi hazırlanmış valiz ve kişisel eşyalar", "Luggage and personal belongings prepared for travel"),
      text("Tedavi öncesi hasta ve doktorun görüşmesi", "A patient and clinician talking before treatment"),
      text("Ev ortamında dizüstü bilgisayar kullanan yetişkin", "An adult using a laptop in a home setting"),
    ],
  },
  "medical-aesthetics": {
    src: "/assets/modules/guides/medical-aesthetics-approved.webp", tileRatio: 1,
    alts: [
      text("Estetik cerrahi seçeneklerini doktorla konuşan yetişkin", "An adult discussing aesthetic surgery options with a clinician"),
      text("Diş doktorunun bir hastaya diş modeli üzerinden açıklama yapması", "A dentist explaining a dental model to a patient"),
      text("Bir yetişkinin saç çizgisinin doktor tarafından değerlendirilmesi", "A clinician assessing an adult’s hairline"),
      text("Ayna eşliğinde estetik hedeflerin konuşulduğu görüşme", "A consultation discussing aesthetic goals with a mirror"),
      text("Cilt değerlendirmesi yapılan bir konsültasyon", "A skin assessment during a consultation"),
      text("Karar öncesinde soruların doktorla ele alınması", "Discussing questions with a clinician before deciding"),
    ],
  },
};
const TILE_MAP: Record<string, [number, number]> = {
  "what-is-a-second-opinion": [0, 5], "how-it-works": [1, 3], "global-examples": [2, 4],
  "healthcare-in-turkiye": [0, 4], "facts-and-figures": [1, 0], "planning-your-journey": [5, 3],
  "aesthetic-surgery": [0, 5], "dental-aesthetics": [1, 5], "hair-transplant": [2, 0],
  "injectable-treatments": [3, 5], "skin-and-laser": [4, 5], "before-you-decide": [5, 0],
};
// Her bağımsız görsel yalnız bir rehber konumunda kullanılır.
const UNIQUE_PHOTOS: Record<string, { src: string; alt: { tr: string; en: string } }> = {
  "facial-aesthetics:hero": {
    "src": "/assets/modules/guides/unique/03-yuz-hero.webp",
    "alt": {
      "tr": "Klinik cihazla yüz görüntülemesi yapılan yetişkin",
      "en": "An adult undergoing clinical facial imaging"
    }
  },
  "facial-aesthetics:inline": {
    "src": "/assets/modules/guides/unique/yuz-detay.webp",
    "alt": {
      "tr": "Yüz değerlendirmesini temsil eden anatomik model ve ayna",
      "en": "An anatomical teaching model and mirror illustrating facial assessment"
    }
  },
  "rhinoplasty:hero": {
    "src": "/assets/modules/guides/unique/04-burun-hero.webp",
    "alt": {
      "tr": "Burun anatomisini gösteren eğitim modeli",
      "en": "An educational nasal anatomy model"
    }
  },
  "rhinoplasty:inline": {
    "src": "/assets/modules/guides/unique/05-burun-inline.webp",
    "alt": {
      "tr": "Burun ölçümü ve cerrahi planlama",
      "en": "Nasal measurement and surgical planning"
    }
  },
  "breast-surgery:hero": {
    "src": "/assets/modules/guides/unique/06-meme-hero-v2.webp",
    "alt": {
      "tr": "Meme anatomisi modeli üzerinden değerlendirme",
      "en": "Assessment using a breast anatomy model"
    }
  },
  "breast-surgery:inline": {
    "src": "/assets/modules/guides/unique/07-meme-inline-v2.webp",
    "alt": {
      "tr": "Meme ultrasonu değerlendirmesini temsil eden klinik görüntüleme",
      "en": "Clinical imaging illustrating breast ultrasound assessment"
    }
  },
  "body-contouring:hero": {
    "src": "/assets/modules/guides/unique/08-vucut-hero.webp",
    "alt": {
      "tr": "Vücut konturu değerlendirmesi ve işlem öncesi işaretleme",
      "en": "Body contour assessment and preprocedure marking"
    }
  },
  "body-contouring:inline": {
    "src": "/assets/modules/guides/unique/09-vucut-inline-v3.webp",
    "alt": {
      "tr": "Karın bölgesinde cihazla vücut şekillendirme uygulaması",
      "en": "A device-based body contouring treatment on the abdomen"
    }
  },
  "planning-your-journey:hero": {
    "src": "/assets/modules/guides/unique/turizm-aura-ekran.webp",
    "alt": {
      "tr": "Evinde AURA ana sayfasını laptop ekranında inceleyen yetişkin",
      "en": "An adult viewing the AURA homepage on a laptop at home"
    }
  },
  "facts-and-figures:inline": {
    "src": "/assets/modules/guides/unique/turizm-veriler.webp",
    "alt": {
      "tr": "Peyzajlı bir alandan görülen temsili sağlık kampüsü",
      "en": "An illustrative healthcare campus seen from a landscaped terrace"
    }
  },
  "dental-aesthetics:inline": {
    "src": "/assets/modules/guides/unique/dis-plan.webp",
    "alt": {
      "tr": "Diş doktoruyla görüntüleme ekranını inceleyen hasta",
      "en": "A patient reviewing a dental scan with a dentist"
    }
  },
  "hair-transplant:inline": {
    "src": "/assets/modules/guides/unique/11-sac-inline.webp",
    "alt": {
      "tr": "Saç ekimi için greft hazırlığını temsil eden sahne",
      "en": "An illustrative scene of graft preparation for hair transplantation"
    }
  },
  "injectable-treatments:inline": {
    "src": "/assets/modules/guides/unique/13-enjeksiyon-inline-v2.webp",
    "alt": {
      "tr": "Yanak bölgesine enjeksiyon uygulaması",
      "en": "An injection treatment in the cheek area"
    }
  },
  "skin-and-laser:inline": {
    "src": "/assets/modules/guides/unique/15-lazer-inline.webp",
    "alt": {
      "tr": "Bacak bölgesinde cihazla lazer uygulaması",
      "en": "A laser treatment on the leg"
    }
  },
  "before-you-decide:hero": {
    "src": "/assets/modules/guides/unique/karar-baslangic.webp",
    "alt": {
      "tr": "Evinde görüşme öncesi sorularını hazırlayan yetişkin",
      "en": "An adult preparing consultation questions at home"
    }
  },
  "before-you-decide:inline": {
    "src": "/assets/modules/guides/unique/karar-teklif-online-v2.webp",
    "alt": {
      "tr": "Hasta ve yakınının evden acente temsilcisiyle çevrim içi görüşmesi",
      "en": "A patient and companion meeting a travel agency coordinator online from home"
    }
  },
  "aesthetic-surgery:hero": {
    "src": "/assets/modules/guides/unique/01-estetik-hero-v2.webp",
    "alt": {
      "tr": "Ameliyat sırasında çalışan estetik cerrahi ekibi",
      "en": "An aesthetic surgery team working in an operating theatre"
    }
  },
  "aesthetic-surgery:inline": {
    "src": "/assets/modules/guides/unique/02-estetik-inline-v2.webp",
    "alt": {
      "tr": "Ekran üzerinden yüz cerrahisi planlaması yapan doktor",
      "en": "A doctor reviewing facial surgery planning on a screen"
    }
  },
  "hair-transplant:hero": {
    "src": "/assets/modules/guides/unique/10-sac-hero.webp",
    "alt": {
      "tr": "Saçlı derinin büyütmeli cihazla incelenmesi",
      "en": "Magnified examination of the scalp"
    }
  },
  "injectable-treatments:hero": {
    "src": "/assets/modules/guides/unique/12-enjeksiyon-hero-v3.webp",
    "alt": {
      "tr": "Erkek hastaya alın bölgesinde enjeksiyon uygulaması",
      "en": "A male patient receiving an injection treatment in the forehead area"
    }
  },
  "skin-and-laser:hero": {
    "src": "/assets/modules/guides/unique/14-lazer-hero.webp",
    "alt": {
      "tr": "Göz korumasıyla yüz bölgesinde lazer uygulaması",
      "en": "A facial laser treatment with eye protection"
    }
  },
  "what-is-a-second-opinion:hero": {
    "src": "/assets/modules/guides/unique/so-definition-inline.webp",
    "alt": {
      "tr": "İki doktorun aynı görüntüleme ve raporları değerlendirmesi",
      "en": "Two doctors reviewing the same scans and reports"
    }
  },
  "what-is-a-second-opinion:inline": {
    "src": "/assets/modules/guides/unique/so-global-hero.webp",
    "alt": {
      "tr": "Doktorların uzaktan tıbbi dosya değerlendirmesi",
      "en": "Doctors reviewing a medical case remotely"
    }
  },
  "how-it-works:inline": {
    "src": "/assets/modules/guides/unique/so-process-inline-v2.webp",
    "alt": {
      "tr": "Raporlarını inceleyip ikinci görüş sorularını hazırlayan hasta",
      "en": "A patient reviewing reports and preparing second-opinion questions"
    }
  },
  "global-examples:hero": {
    "src": "/assets/modules/guides/unique/so-global-hero-v2.webp",
    "alt": {
      "tr": "Görüntüleri inceleyerek yazılı görüş hazırlayan doktor",
      "en": "A doctor reviewing scans and preparing a written opinion"
    }
  },
  "global-examples:inline": {
    "src": "/assets/modules/guides/unique/so-global-inline-v2.webp",
    "alt": {
      "tr": "Evinden doktorla çevrim içi ikinci görüş görüşmesi yapan hasta",
      "en": "A patient having an online second-opinion consultation from home"
    }
  },
  "healthcare-in-turkiye:inline": {
    "src": "/assets/modules/guides/unique/tourism-clinical-inline.webp",
    "alt": {
      "tr": "Seyahat öncesinde doktorla çevrim içi ortopedik değerlendirme yapan hasta",
      "en": "A patient having an online orthopaedic assessment before travelling"
    }
  }
};
export function hasGuidePhoto(slug: string) { return Boolean(UNIQUE_PHOTOS[`${slug}:hero`] || TILE_MAP[slug]); }
export function GuidePhoto({ moduleKey, slug, placement, lang }: { moduleKey: ModuleKey; slug: string; placement: "hero" | "inline"; lang: Lang }) {
  if (slug === "healthcare-in-turkiye" && placement === "hero") {
    return <figure className={styles.guidePhoto}>
      <video autoPlay loop controls playsInline muted preload="auto" poster="/assets/modules/guides/bosphorus-poster.jpg" style={{ width: "100%", aspectRatio: "16 / 9", display: "block", borderRadius: 8 }} aria-label={lang === "tr" ? "İstanbul Boğazı üzerinde ilerleyen AURA videosu" : "AURA video over the Bosphorus in Istanbul"}>
        <source src="/assets/modules/guides/bosphorus-720.mp4" type="video/mp4" />
      </video>
      <figcaption>{aiNoticeText(lang)}</figcaption>
    </figure>;
  }
  const unique = UNIQUE_PHOTOS[`${slug}:${placement}`];
  const photo = PHOTOS[moduleKey];
  if (!unique && !TILE_MAP[slug]) return null;
  const tile = TILE_MAP[slug]?.[placement === "hero" ? 0 : 1] ?? 0;
  const alt = readText(unique?.alt ?? photo.alts[tile], lang);
  return <figure className={`${styles.guidePhoto} ${placement === "inline" ? styles.inlinePhoto : ""}`}>
    <div className={styles.guidePhotoViewport}>
      {unique ? <Image src={unique.src} alt={alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 70vw, 800px" style={{ objectFit: "cover" }} preload={placement === "hero"} /> : <div className={styles.guidePhotoCrop} style={{ aspectRatio: photo.tileRatio }}>
        <div className={styles.guidePhotoSheet} style={{ left: `${-(tile % 3) * 100}%`, top: `${-Math.floor(tile / 3) * 100}%` }}>
          <Image src={photo.src} alt={alt} fill sizes="(max-width: 640px) 300vw, 1800px" preload={placement === "hero"} />
        </div>
      </div>}
    </div>
    <figcaption>{aiNoticeText(lang)}</figcaption>
  </figure>;
}

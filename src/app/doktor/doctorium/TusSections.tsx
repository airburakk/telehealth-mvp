import { CalendarDays } from "lucide-react";
import type { TusSectionKey } from "@/lib/tus";
import { TusOfficialLinksPanel, TusPeriodsPanel, TusPlacementSection } from "./CareerEduSections";
import { TusGuidesPanel, TusResourcesPanel } from "./TusGuideResourcePanels";
import { YokTipSection } from "./TusYokSection";
import { TusInstitutionsSection } from "./TusInstitutionsSection";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { AuraButtonLink } from "@/components/ui/AuraButton";

/**
 * TUS sayfasının ÜÇ BÖLÜMÜ (2026-09-06, kullanıcı kararı "TUS'u kendi içinde böl: veriler · rehberler · sınav dönemleri").
 * Paneller değişmedi (CareerEduSections · TusGuideResourcePanels · TusYokSection · TusInstitutionsSection); yalnız istif
 * bölündü: eskiden 7 panel art arda tek sayfadaydı. Hangi bölümün açık olduğu ?bolum= (lib/tus parseTusSection; varsayılan Veriler).
 *  · Veriler        → yerleştirme grafikleri (#yerlestirme) · kurum tablosu (#kurumlar; süzgeçler URL'de) · tıp fakülteleri (#yok)
 *  · Rehberler      → ÖSYM kılavuzu özetleri · resmî kaynaklar · kaynakça/kurs dizini (#kaynakca)
 *  · Sınav dönemleri → dönem tablosu + Takvim bağlantısı (TUS günleri öğrenci Takvim'inde daima, doktorda showTus ile)
 * Veri kuralları aynen sürer: 👤 approvedAt olmayan kayıt görünmez; tahmin/tavsiye yok.
 */
const VERILER_ANCHORS = [
  { href: "#yerlestirme", label: "Yerleştirme verisi" },
  { href: "#kurumlar", label: "Kurumlar" },
  { href: "#yok", label: "Tıp fakülteleri" },
];

/** tusBrans: Özelleştir'deki varsayılan branş (öğrenci, 2026-09-06) — grafik ve kurum tablosu bununla açılır; ?brans= onu ezer. */
export async function TusSectionBody({ section, sp, tusBrans = null }: { section: TusSectionKey; sp: Record<string, string | string[] | undefined>; tusBrans?: string | null }) {
  if (section === "rehberler") {
    return (
      <>
        <TusGuidesPanel className="mt-6" />
        <TusOfficialLinksPanel className="mt-6" />
        <TusResourcesPanel className="mt-6" />
      </>
    );
  }
  if (section === "donemler") {
    return (
      <>
        <TusPeriodsPanel className="mt-6" />
        <AuraPanel title="Takviminizde" meta="BAŞVURU · SINAV · SONUÇ" className="mt-6">
          <p className="text-[13px] leading-relaxed text-[var(--c-ink-2)]">
            Başvuru penceresi, sınav günü ve sonuç tarihi Takvim&apos;inizde de görünür; ay görünümünde diğer son tarihlerle yan yana okursunuz.
          </p>
          <div className="mt-3">
            <AuraButtonLink href="/doktor/doctorium/takvim"><CalendarDays size={15} aria-hidden /> Takvimim</AuraButtonLink>
          </div>
        </AuraPanel>
      </>
    );
  }
  return (
    <>
      <p className="aura-mono mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--c-ink-3)]">
        <span>Bu bölümde:</span>
        {VERILER_ANCHORS.map((a) => (
          <a key={a.href} href={a.href} className="font-semibold text-[var(--c-ink-2)] underline-offset-2 hover:text-[var(--c-accent)] hover:underline">{a.label}</a>
        ))}
      </p>
      <TusPlacementSection className="mt-4" initialBranch={tusBrans} />
      <TusInstitutionsSection sp={sp} className="mt-6" defaultBranch={tusBrans} />
      <YokTipSection className="mt-6" />
    </>
  );
}

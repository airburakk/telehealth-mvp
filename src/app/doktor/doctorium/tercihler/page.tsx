import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import {
  BRANCH_OPTIONS, parseBranchPrefs, parseFeedModules, slugForLabel,
  todayModuleCounts, EVENT_TYPES, parseEventTypePref,
  RANGE_OPTIONS, SECTOR_CATEGORIES, parseViewPrefs,
} from "@/lib/doctorium";
import { SPONSOR_CONSENT_TEXT } from "@/lib/sponsor";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PreferencesBoard } from "./PreferencesBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Akış Tercihleri" };

/**
 * AKIŞ TERCİHLERİ — tek ayar sayfası (v6.132, kullanıcı kararı 2026-08-20; v6.142'de GENİŞLEDİ).
 *
 * 🔄 SÜPERSEDE: bu rota v6.49'dan beri `/doktor/doctorium`e YÖNLENDİREN bir iskeletti (o gün
 * tercihler sekme-altı panele taşınmıştı). v6.132'de karar geri alındı ama farklı bir gerekçeyle:
 * panel hem GÖRÜNÜM süzgeçlerini (bu sekmede ne görüyorum) hem KALICI tercihleri (akışım nasıl
 * kurulu) taşıyordu ve ikisi karışıyordu — ayrım çizildi: sekme içi panel yalnız görünüm süzgeci,
 * bu sayfa yalnız kalıcı tercih.
 *
 * 🔄 SÜPERSEDE #2 (v6.142, kullanıcı kararı 2026-08-23): "iki ekran" ayrımının KENDİSİ döküntü
 * üretti — sektörel/ilaç/etkinlik/mevzuat sekmelerinde AYNI ADLA ("Özelleştir") iki farklı kontrol
 * duruyordu. Çözüm ayrımı derinleştirmek değil KALDIRMAK oldu: sekme içi panel (DoctoriumFilters.tsx)
 * tamamen silindi; Kaynak/Geriye dönük/Kategori de etkinlik türü/kapsamının zaten izlediği modele
 * geçti — kalıcı Doctor satırı (parseViewPrefs) + URL parametresi yalnız o görünüm için ezer.
 * Artık TEK ekran, TEK "Özelleştir" düğmesi her sekmede aynı yere (buraya) götürür.
 *
 * Erişim: segment layout'u zaten DOCTOR/COORDINATOR/ADMIN kapısını uyguluyor; burada ayrıca
 * doktor profili şartı var (tercihler Doctor satırına yazılır — personelin branşı/alarmı yok).
 */
export default async function TercihlerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  // Personel (COORDINATOR/ADMIN) gözetim için portala girebilir ama yazacağı tercih yok →
  // akışa geri gönderilir (koşullu-href ilkesinin sayfa düzeyindeki karşılığı).
  if (!me?.doctorId) redirect("/doktor/doctorium");

  const doctor = await db.doctor.findUnique({
    where: { id: me.doctorId },
    select: {
      branch: true, newsBranches: true, feedModules: true,
      congressAlertDays: true, congressAbstractAlertDays: true, congressEarlyBirdAlertDays: true,
      congressEventTypes: true, congressScope: true,
      // v6.142 — Sektörel/İlaç & Cihaz/Mevzuat GÖRÜNÜM süzgeçleri (aynı sözleşme).
      doctoriumViewPrefs: true,
      sponsorPersonalizationAt: true,
      digestChannel: true, // Doctorium Post günlük özet aboneliği (2026-08-24)
    },
  });
  if (!doctor) redirect("/doktor");

  // Sponsorlu içerik rızası yalnız o yüzeyi GÖREN üyeye sorulur: doğrulanmış doktor. Öğrenci ve
  // deneme üyesinde kapalı (2026-09-05 üç katman; tek sözcü lib/doctorium-audience).
  const audienceCtx = await currentDoctoriumAudience();
  const canSeeSponsored = audienceCtx?.flags.canSeeSponsored ?? false;
  const viewPrefs = parseViewPrefs(doctor.doctoriumViewPrefs);

  return (
    <DoctoriumShell active={null} counts={await todayModuleCounts()}>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link
          href="/doktor/doctorium"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
        >
          <ArrowLeft size={15} /> Akışıma dön
        </Link>

        <div className="mt-5">
          <div className="aura-mono text-[11px] font-bold tracking-[0.16em] text-emerald-300">
            AKIŞ TERCİHLERİ
          </div>
          <h1 className="aura-display mt-1 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            Akışınızı kendiniz kurun
          </h1>
          {/* Kullanıcı onaylı açıklama (2026-08-20) — kurumsal ton. */}
          <p className="mt-2.5 max-w-[68ch] text-[14px] leading-relaxed text-[var(--c-ink-2)]">
            Tüm akışınızı kendinize özel biçimde organize edebilirsiniz. İlgi alanlarınızın
            dışında hiçbir içerikle karşılaşmadan platformu en verimli şekilde kullanabilir,
            ayarlarınızı istediğiniz zaman değiştirebilirsiniz.
          </p>
        </div>

        <PreferencesBoard
          feedInitial={parseFeedModules(doctor.feedModules)}
          branchOptions={BRANCH_OPTIONS.map((b) => ({ slug: b.slug, label: b.label }))}
          branchInitial={parseBranchPrefs(doctor.newsBranches)}
          ownBranchSlug={slugForLabel(doctor.branch)}
          alertStart={doctor.congressAlertDays}
          alertAbstract={doctor.congressAbstractAlertDays}
          alertEarlyBird={doctor.congressEarlyBirdAlertDays}
          eventTypeOptions={EVENT_TYPES.map((t) => ({ key: t.key, label: t.label }))}
          eventTypesInitial={parseEventTypePref(doctor.congressEventTypes)}
          scopeInitial={doctor.congressScope}
          rangeOptions={RANGE_OPTIONS.map((r) => ({ key: r.key, label: r.label }))}
          categoryOptions={SECTOR_CATEGORIES}
          sectorInitial={viewPrefs.sektorel}
          pharmaInitial={viewPrefs.ilac}
          legalViewInitial={viewPrefs.mevzuat}
          showSponsor={canSeeSponsored}
          sponsorInitial={!!doctor.sponsorPersonalizationAt}
          sponsorText={SPONSOR_CONSENT_TEXT}
          digestInitial={doctor.digestChannel}
        />
      </div>
    </DoctoriumShell>
  );
}

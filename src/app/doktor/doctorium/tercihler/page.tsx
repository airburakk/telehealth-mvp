import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStudentOnly } from "@/lib/doctor-activation";
import { getDoctorBalance } from "@/lib/rewards";
import {
  BRANCH_OPTIONS, parseBranchPrefs, parseFeedModules, slugForLabel,
  todayModuleCounts, EVENT_TYPES, parseEventTypePref,
} from "@/lib/doctorium";
import { SPONSOR_CONSENT_TEXT } from "@/lib/sponsor";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PreferencesBoard } from "./PreferencesBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Akış Tercihleri" };

/**
 * AKIŞ TERCİHLERİ — tek ayar sayfası (v6.132, kullanıcı kararı 2026-08-20).
 *
 * 🔄 SÜPERSEDE: bu rota v6.49'dan beri `/doktor/doctorium`e YÖNLENDİREN bir iskeletti (o gün
 * tercihler sekme-altı panele taşınmıştı). Karar geri alındı ama farklı bir gerekçeyle: panel
 * hem GÖRÜNÜM süzgeçlerini (bu sekmede ne görüyorum) hem KALICI tercihleri (akışım nasıl
 * kurulu) taşıyordu ve ikisi karışıyordu. Artık ayrım net:
 *   · Sekme içindeki "Özelleştir" paneli → yalnız görünüm süzgeçleri (aralık, kategori, tür).
 *   · Bu sayfa → yalnız KALICI tercihler (hangi bölümler akışa girer, branşlar, alarmlar, rıza).
 * v6.49'un "iki ayrı tercih ekranı sürüklenir" endişesi bu ayrımla karşılanıyor: aynı ayar
 * iki yerde YAŞAMIYOR.
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
      activatedAt: true, studentVerifiedAt: true,
      congressAlertDays: true, congressAbstractAlertDays: true, congressEarlyBirdAlertDays: true,
      congressEventTypes: true, congressScope: true,
      sponsorPersonalizationAt: true,
    },
  });
  if (!doctor) redirect("/doktor");

  // v6.95: öğrenci-sınırlı üye pazarlama yüzeyi görmez → sponsorlu içerik rızası da sorulmaz.
  const studentOnly = isStudentOnly(doctor);
  const balance = studentOnly ? null : await getDoctorBalance(me.doctorId);

  return (
    <DoctoriumShell active={null} balance={balance} isDoctor counts={await todayModuleCounts()}>
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
          showSponsor={!studentOnly}
          sponsorInitial={!!doctor.sponsorPersonalizationAt}
          sponsorText={SPONSOR_CONSENT_TEXT}
        />
      </div>
    </DoctoriumShell>
  );
}

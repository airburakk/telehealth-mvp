import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { clinicalDoctorFor } from "@/lib/doctor-activation";
import { type Severity } from "@/lib/postop";
import { recoveryClosed } from "@/lib/postop-access";
import { formatDateTime } from "@/lib/constants";
import { decryptField } from "@/lib/crypto";
import { Lock } from "lucide-react";
import { RecoveryList, type ActiveRecoveryRow } from "./RecoveryList";

export const dynamic = "force-dynamic";

const DOCTOR_ROLES = ["DOCTOR", "COORDINATOR", "ADMIN"];
const RANK: Record<Severity, number> = { RED: 0, WATCH: 1, NONE: 2 };

// Post-Op İzleme (doktor). v6.66: aktif liste + KPI'lar client bileşene çıktı (RecoveryList) —
// KPI sayıları tıklanır filtre oldu (doktor ana sayfası "Eşleşen Vakalar" CaseQueue deseni).
// Bu dosyada kalanlar SUNUCU işleri: auth (DB-rol otoriter), sorgu, decryptField (PHI çözümü
// client'a inmez — ad çözülmüş DÜZ metin olarak props'la gider, şifre anahtarı gitmez) ve
// E2EE Faz 2A gereği salt-metadata "tamamlanan takipler" bölümü.
export default async function RecoveryMonitor() {
  // Derinlemesine savunma (2026-07-12): proxy /doktor/* TOKEN roluyle korur; post-op takip listesi
  // hasta adı + ağrı/ateş/şiddet (ÇÖZÜLMÜŞ PHI) gösterdiğinden getCurrentUser (DB-rol otoriter) ŞART.
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/takip");
  if (!DOCTOR_ROLES.includes(user.role)) redirect("/");

  // v6.87 — İKİ daraltma birden (dış denetim "liste uçları kör noktası" dersi, SO soCaseListScope
  // eşleniği): (1) Aşama 2 kapısı — aktivasyonsuz DOCTOR bu sayfayı hiç açamaz; (2) sahiplik —
  // DOCTOR yalnız KENDİSİNE atanmış vakaların post-op'unu görür (liste, nesne-düzeyi kapıdan geniş
  // veri döndüremez). COORDINATOR/ADMIN gözetim tam listede kalır. Silme-kilitli vaka (deletionLockedAt)
  // hiçbir rolde listelenmez — kilit rol kontrolünden önce gelir (ownership kuralı).
  const clin = user.role === "DOCTOR" ? await clinicalDoctorFor(user.id) : null;
  if (user.role === "DOCTOR" && !clin) redirect("/doktor/baslangic");

  const recoveries = await db.recovery.findMany({
    where: { case: { deletionLockedAt: null, ...(clin ? { doctorId: clin.doctorId } : {}) } },
    include: {
      case: { select: { patientName: true, country: true, branch: true } }, // listede yalnız kimlik+ülke+branş
      // not/foto (artık base64) bu listede gereksiz; yalnız SON kontrolün hafif scalar alanları (payload hafif kalsın)
      checkIns: { take: 1, orderBy: { createdAt: "desc" }, select: { severity: true, pain: true, feverC: true, createdAt: true } },
      _count: { select: { checkIns: true } }, // toplam kontrol sayısı — satırları çekmeden
    },
    orderBy: { startedAt: "desc" },
  });

  const all = recoveries.map((r) => {
    const last = r.checkIns[0];
    const severity = (last?.severity as Severity) ?? "NONE";
    const day = Math.max(1, Math.floor((Date.now() - new Date(r.startedAt).getTime()) / 86400000) + 1);
    // E2EE Faz 2A — tamamlanmış (manuel COMPLETED veya otomatik süre+tampon) takiplerde personel erişimi kapalı.
    const closed = recoveryClosed(r);
    return { r, last, severity, day, count: r._count.checkIns, closed };
  });

  const active = all.filter((x) => !x.closed.closed).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  // Kapanma lazy hesaplandığından (DB alanı değil) dilim in-memory: en güncel 20 tamamlanan gösterilir.
  const completed = all.filter((x) => x.closed.closed).slice(0, 20);

  // Client bileşene SERİLEŞTİRİLMİŞ satırlar: Date → ISO, PHI sunucuda çözülür.
  const rows: ActiveRecoveryRow[] = active.map(({ r, last, severity, day, count }) => ({
    id: r.id,
    caseId: r.caseId,
    branch: r.branch,
    patientName: decryptField(r.case.patientName) ?? "",
    country: r.case.country,
    day,
    count,
    severity,
    last: last ? { pain: last.pain, feverC: last.feverC, createdAt: last.createdAt.toISOString() } : null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      {/* v6.64 hizalama: dolu turkuaz ikon bloğu KALDIRILDI (iç yüzeyde tekildi) — başlık
          /doktor ve /vakalarim ile aynı sade display deseni. */}
      <div>
        <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Post-Op İzleme</h1>
        <p className="mt-1 text-sm text-[var(--c-ink-2)]">Uzaktan iyileşme takibi — alarm bulgulu hastalar üstte.</p>
      </div>

      <RecoveryList rows={rows} />

      {/* E2EE Faz 2A — tamamlanmış takipler: klinik erişim hastaya devredildi → yalnız metadata, klinik içerik linki YOK. */}
      {completed.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">
            <Lock size={13} /> Tamamlanan takipler · erişim hastada
          </div>
          <div className="mt-3 space-y-2">
            {completed.map(({ r, day, count, closed }) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3.5 text-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"><Lock size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--c-ink-2)]">{decryptField(r.case.patientName)}</span>
                    <span className="text-xs text-[var(--c-ink-3)]">{r.branch}</span>
                  </div>
                  <div className="text-xs text-[var(--c-ink-3)]">
                    {closed.reason === "MANUAL" ? "Doktor tamamladı" : "Süre doldu (otomatik)"}
                    {r.completedAt ? ` · ${formatDateTime(r.completedAt)}` : ""} · {count} kontrol · {day}. gün
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--c-ink)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--c-ink-2)]">klinik erişim kapalı</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

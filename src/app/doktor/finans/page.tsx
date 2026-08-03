import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatUSD } from "@/lib/pricing";
import { formatDateTime } from "@/lib/constants";
import { decryptField } from "@/lib/crypto";
import { answeredStatsForDoctor } from "@/lib/consultation-requests";
import { ArrowLeft, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

// Sekme başlığı "Finans · AURA" — kök layout template'i (%s · AURA) ekler, ELLE " · AURA" YAZMA
// (v6.43 dersi: çift-AURA olur).
export const metadata = { title: "Finans" };

// Finans — kulvar-ayrımlı hakediş dökümü (2026-08-01, kullanıcı kararı, 3 adım):
// profildeki "Hakediş" önce "Finans" adını aldı, sonra bu ayrı sayfaya taşındı, ardından
// konsültasyon sayfasındaki hakediş penceresi de buraya katıldı — dört kulvar ayrı bölümde:
// Uzaktan Sağlık · İkinci Görüş · Sağlık Turizmi · Konsültasyon Talepleri.
// Kulvar rengi yüzey BOYAMAZ (Aura kuralı): 3px kenar şeridi + mono etiket.
//
// Ücret modeli DEMO: görüşme brütü ve %20 platform komisyonu simüle (profil v1'den miras);
// SO'da hasta ödemesi (SecondOpinionPayment) gerçek kayıttır, doktor payı aynı demo komisyonla
// gösterilir. ⚠️ Sağlık Turizmi'nde DOKTOR PAYI MODELİ YOK — Booking split'i kurum kalemlerine
// bölünür (hastane/otel/uçak/…; doktor payı "hastane" kalemi İÇİNDE örtük) → burada tutar
// UYDURULMAZ, rezervasyonlar escrow durumuyla listelenir, pay mutabakat notuna bağlanır.
const CONSULT_FEE = 150;
const COMMISSION = 0.2;

const ESCROW_LABEL: Record<string, { text: string; cls: string }> = {
  HELD: { text: "Emanette", cls: "bg-amber-500/15 text-amber-300" },
  RELEASED: { text: "Serbest bırakıldı", cls: "bg-emerald-500/15 text-emerald-300" },
  REFUNDED: { text: "İade edildi", cls: "bg-red-500/15 text-red-300" },
  PENDING: { text: "Onay (ödemesiz)", cls: "bg-[var(--c-surface)] text-[var(--c-ink-3)]" },
};

function LaneCard({ lane, title, right, children }: { lane: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section
      className="rounded-3xl border border-[var(--c-hairline)] border-s-[3px] bg-[var(--c-panel)] p-5 shadow-sm"
      style={{ borderInlineStartColor: `var(--lane-${lane})` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="aura-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: `var(--lane-${lane})` }}>{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

function NetRozet({ value, note }: { value: number; note: string }) {
  return (
    <div className="text-right">
      <div className="text-lg font-bold text-emerald-300">{formatUSD(value)}</div>
      <div className="text-[10px] text-[var(--c-ink-3)]">{note}</div>
    </div>
  );
}

export default async function FinansPage() {
  const session = await getCurrentUser();
  const u = session ? await db.user.findUnique({ where: { id: session.id } }) : null;
  const doctor = u?.doctorId
    ? await db.doctor.findUnique({
        where: { id: u.doctorId },
        include: { consultations: { include: { case: true }, orderBy: { startedAt: "desc" } } },
      })
    : null;

  if (!doctor) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="aura-display text-2xl font-medium tracking-tight text-[var(--c-ink)]">Doktor profili bağlı değil</h1>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">Finans dökümü yalnız doktor profiline bağlı hesaplarda görünür.</p>
        <Link href="/doktor" className="mt-5 inline-flex rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">Doktor Paneli</Link>
      </div>
    );
  }

  const [soCases, bookings, consultStats, consultLast] = await Promise.all([
    // İkinci Görüş: görüş TESLİM EDİLMİŞ vakalar (hakediş teslime bağlanır); ödeme kaydı gerçek.
    db.secondOpinionCase.findMany({
      where: { assignedDoctorId: doctor.id, opinionDeliveredAt: { not: null } },
      orderBy: { opinionDeliveredAt: "desc" },
      select: { id: true, opinionDeliveredAt: true, payment: { select: { amount: true, status: true } } },
    }),
    // Sağlık Turizmi: doktorun vakalarına bağlı rezervasyonlar (pay modeli yok — liste + escrow durumu).
    db.booking.findMany({
      where: { case: { doctorId: doctor.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, tier: true, total: true, escrowStatus: true, createdAt: true },
    }),
    answeredStatsForDoctor(doctor.id), // kümülatif — liste tavanlı, reduce yanlış olurdu (v4.17)
    db.consultationRequest.findMany({
      where: { answeredByDoctorId: doctor.id, status: "ANSWERED" },
      orderBy: { answeredAt: "desc" },
      take: 5,
      select: { id: true, answeredAt: true, paymentSim: true },
    }),
  ]);

  // Uzaktan Sağlık — tamamlanan vaka görüşmeleri (profilden taşınan demo model).
  const net = CONSULT_FEE * (1 - COMMISSION);
  const ended = doctor.consultations.filter((c) => c.status === "ENDED");
  const teleEarnings = ended.map((c) => ({ id: c.id, patient: decryptField(c.case.patientName), date: c.endedAt ?? c.startedAt, net }));
  const teleTotal = teleEarnings.reduce((a, b) => a + b.net, 0);

  // İkinci Görüş — yalnız ÖDENMİŞ kayıtlar toplama girer; bekleyenler rozetle görünür.
  const soRows = soCases.map((s) => ({
    id: s.id,
    date: s.opinionDeliveredAt!,
    paid: s.payment?.status === "PAID",
    net: s.payment && s.payment.status === "PAID" ? Math.round(s.payment.amount * (1 - COMMISSION)) : 0,
  }));
  const soTotal = soRows.reduce((a, b) => a + b.net, 0);

  const consultTotal = consultStats.totalEarned;
  const grandTotal = teleTotal + soTotal + consultTotal;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Ana Sayfa
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="aura-display flex items-center gap-2.5 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            <Wallet size={26} className="text-emerald-300" /> Finans
          </h1>
          <p className="mt-1 text-sm text-[var(--c-ink-2)]">Kulvar bazında hakedişleriniz.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--c-ink-3)]">Genel toplam net (komisyon sonrası)</div>
          <div className="text-2xl font-bold text-emerald-300">{formatUSD(grandTotal)}</div>
          <div className="text-[10px] text-[var(--c-ink-3)]">Sağlık turizmi payları mutabakatta — toplama dahil değil</div>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* ── Uzaktan Sağlık ── */}
        <LaneCard lane="telehealth" title="Uzaktan Sağlık" right={<NetRozet value={teleTotal} note={`${teleEarnings.length} görüşme`} />}>
          {teleEarnings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--c-ink-3)]">Henüz tamamlanmış görüşme yok.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--c-hairline)]">
              {teleEarnings.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-[var(--c-ink)]">Görüşme · {e.patient}</div>
                    <div className="text-xs text-[var(--c-ink-3)]">{formatDateTime(e.date)} · brüt {formatUSD(CONSULT_FEE)} · %{COMMISSION * 100} komisyon</div>
                  </div>
                  <span className="font-semibold text-[var(--c-ink)]">{formatUSD(e.net)}</span>
                </li>
              ))}
            </ul>
          )}
        </LaneCard>

        {/* ── İkinci Görüş ── */}
        <LaneCard lane="so" title="İkinci Görüş" right={<NetRozet value={soTotal} note={`${soRows.length} teslim edilen görüş`} />}>
          {soRows.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--c-ink-3)]">Henüz teslim edilmiş ikinci görüş raporu yok.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--c-hairline)]">
              {soRows.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-[var(--c-ink)]">Görüş raporu · #{s.id.slice(-6).toUpperCase()}</div>
                    <div className="text-xs text-[var(--c-ink-3)]">{formatDateTime(s.date)} · %{COMMISSION * 100} komisyon</div>
                  </div>
                  {s.paid ? (
                    <span className="font-semibold text-[var(--c-ink)]">{formatUSD(s.net)}</span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Ödeme bekleniyor</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </LaneCard>

        {/* ── Sağlık Turizmi ── */}
        <LaneCard lane="tourism" title="Sağlık Turizmi" right={<div className="text-[11px] text-[var(--c-ink-3)]">{bookings.length} rezervasyon</div>}>
          {bookings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--c-ink-3)]">Vakalarınıza bağlı rezervasyon yok.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--c-hairline)]">
              {bookings.map((b) => {
                const esc = ESCROW_LABEL[b.escrowStatus] ?? { text: b.escrowStatus, cls: "bg-[var(--c-surface)] text-[var(--c-ink-3)]" };
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <div className="font-medium text-[var(--c-ink)]">{b.tier} paket · toplam {formatUSD(b.total)}</div>
                      <div className="text-xs text-[var(--c-ink-3)]">{formatDateTime(b.createdAt)}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${esc.cls}`}>{esc.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-[var(--c-ink-3)]">Doktor payı ayrı bir kalem olarak tanımlı değil (hastane/klinik payı içinde) — ay sonu mutabakatında netleşir; bu bölümdeki tutarlar paket toplamıdır, hakediş toplamına eklenmez.</p>
        </LaneCard>

        {/* ── Konsültasyon Talepleri ── */}
        <LaneCard lane="consult" title="Konsültasyon Talepleri" right={<NetRozet value={consultTotal} note={`${consultStats.count} yanıt`} />}>
          {consultLast.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--c-ink-3)]">Henüz yanıtlanmış konsültasyon talebi yok.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--c-hairline)]">
              {consultLast.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-[var(--c-ink)]">Konsültasyon yanıtı · #{r.id.slice(-6).toUpperCase()}</div>
                    <div className="text-xs text-[var(--c-ink-3)]">{r.answeredAt ? formatDateTime(r.answeredAt) : "—"}</div>
                  </div>
                  <span className="font-semibold text-[var(--c-ink)]">{formatUSD(r.paymentSim ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
          {consultStats.count > consultLast.length && (
            <p className="mt-3 text-[11px] text-[var(--c-ink-3)]">Son {consultLast.length} yanıt gösteriliyor — toplam {consultStats.count} yanıtın tümü hakediş toplamına dahil.</p>
          )}
        </LaneCard>
      </div>

      <p className="mt-5 text-[11px] text-[var(--c-ink-3)]">Ücret ve komisyon oranları simülasyondur; gerçek mutabakat escrow/ödeme entegrasyonuyla gelir. Tedavi paketi payları ay sonu mutabakatında eklenir (demo).</p>
    </div>
  );
}

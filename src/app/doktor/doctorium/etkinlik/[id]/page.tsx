import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { congressById, isFollowingCongress, branchLabel, scopeBadge, EVENT_TYPE_LABEL } from "@/lib/doctorium";
import { BranchAvatar } from "@/components/BranchAvatar";
import { hasBranchVisual } from "@/lib/branch-visuals";
import { FollowButton } from "../../CongressControls";
import {
  ArrowLeft, AlertTriangle, Building2, CalendarDays, ExternalLink,
  Globe, Languages, MapPin, Presentation, ShieldCheck, Ticket, Video,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Etkinlik" };

/**
 * Etkinlik bilgi kartı (v6.62 "kongre kartı"; v6.120'de tüm etkinlik türlerine açıldı) —
 * her etkinliğin kendi sayfası.
 *
 * VERİ DÜRÜSTLÜĞÜ: alanlar yalnız DOLUYSA basılır; boş alan "bilinmiyor" diye uydurulmaz.
 * Kayıt ücretleri değişkendir → kartta daima "resmî siteden teyit edin" ibaresi ve doğrulama
 * tarihi gösterilir (veri derleme anının fotoğrafıdır).
 *
 * PROGRAM/KONUŞMACI: tam program KOPYALANMAZ (telif + etkinlikten 1-2 ay önce kesinleşir, bayat
 * bilgi doktoru yanıltır) → ana temalar + resmî programa bağlantı (kullanıcı kararı 2026-08-03).
 *
 * GÖRSEL: kapak `coverImage` doluysa data URI'dir (og:image yerel script'le indirilip sharp'la
 * webp'e re-encode edilir — scripts/fetch-congress-covers.ts; CSP `img-src 'self' data:` dış
 * hostu engeller, data: izinli). Yoksa branş amblemi.
 */
export default async function CongressCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const { id } = await params;
  const c = await congressById(id);
  if (!c) notFound();

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctorId = me?.doctorId ?? null;
  const following = doctorId ? await isFollowingCongress(doctorId, c.id) : false;

  const slugs = safeSlugs(c.branchSlugs);
  const coverSlug = slugs.find((s) => hasBranchVisual(s)) ?? null;
  const sources = safeSlugs(c.sourceUrls);

  const isPast = c.startDate.getTime() < Date.now() - 86400000;
  const days = Math.round((c.startDate.getTime() - Date.now()) / 86400000);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor/doctorium?m=etkinlik" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Etkinlik Takvimi
      </Link>

      {/* ── Kapak ── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]">
        <div className="relative flex items-center gap-4 bg-[var(--c-surface-2)] px-5 py-5">
          {c.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- kendi Blob'umuzdan, boyutu değişken
            <img src={c.coverImage} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          ) : coverSlug ? (
            <BranchAvatar branchKey={coverSlug} size={64} />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="aura-mono rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[var(--c-ink-2)]">
                {scopeBadge(c.scope)}
              </span>
              {/* Tür rozeti (v6.120): kart 9 tür taşıyor, ilk ayrım bu. */}
              <span className="aura-mono rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[var(--c-ink-2)]">
                {EVENT_TYPE_LABEL[c.eventType] ?? "Etkinlik"}
              </span>
              {c.frequency && (
                <span className="aura-mono rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[var(--c-ink-3)]">
                  {c.frequency === "yillik" ? "Yıllık" : c.frequency === "2-yilda-bir" ? "2 yılda bir" : c.frequency}
                </span>
              )}
              {!isPast && days >= 0 && (
                <span className="aura-mono rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300">
                  {days === 0 ? "bugün başlıyor" : `${days} gün kaldı`}
                </span>
              )}
            </div>
            <h1 className="aura-display mt-1.5 text-xl font-medium tracking-tight text-[var(--c-ink)]">{c.title}</h1>
            {c.organizer && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--c-ink-2)]">
                <Building2 size={12} /> {c.organizer}
              </p>
            )}
          </div>
          {doctorId && (
            <div className="ml-auto self-start">
              <FollowButton key={String(following)} congressId={c.id} following={following} />
            </div>
          )}
        </div>

        {/* ⚠️ Uyarı bandı — sahte kayıt sitesi ihbarı gibi kritik notlar (ERA · IDWeek · EPA
            resmî uyarı yayımlıyor). Doluysa GÖRÜNÜR şekilde, en üstte. */}
        {c.warning && (
          <p className="flex items-start gap-2 border-t border-amber-400/30 bg-amber-500/10 px-5 py-3 text-xs text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{c.warning}</span>
          </p>
        )}

        {/* ── Künye ── */}
        <dl className="grid gap-x-6 gap-y-3 border-t border-[var(--c-hairline)] px-5 py-4 text-sm sm:grid-cols-2">
          <Field icon={<CalendarDays size={13} />} label="Tarih">
            {fmt(c.startDate)}{c.endDate ? ` – ${fmt(c.endDate)}` : ""}
          </Field>
          {(c.city || c.country) && (
            <Field icon={<MapPin size={13} />} label="Yer">
              {[c.city, c.country !== "TR" ? c.country : null].filter(Boolean).join(", ")}
              {c.venue && <span className="block text-xs text-[var(--c-ink-3)]">{c.venue}</span>}
            </Field>
          )}
          {c.abstractDeadline && (
            <Field icon={<Presentation size={13} />} label="Bildiri son gönderim">{fmt(c.abstractDeadline)}</Field>
          )}
          {c.earlyBirdDeadline && (
            <Field icon={<Ticket size={13} />} label="Erken kayıt son tarih">{fmt(c.earlyBirdDeadline)}</Field>
          )}
          {c.format && (
            <Field icon={<Video size={13} />} label="Katılım biçimi">
              {c.format === "hibrit" ? "Hibrit (yüz yüze + çevrimiçi)" : c.format === "online" ? "Çevrimiçi" : "Yüz yüze"}
            </Field>
          )}
          {c.language && <Field icon={<Languages size={13} />} label="Dil">{c.language}</Field>}
          {/* TTB kaydında cmeCredit zaten "TTB akredite (KOD)" — aşağıdaki TTB BÖLÜMÜYLE
              birebir aynı şeyi söylerdi. Kredi alanı KÜRATÖRLÜ kayıtların gerçek kredi
              notu içindir (ör. "EACCME 18 kredi"), o yüzden ttbCode varken çizilmez. */}
          {c.cmeCredit && !c.ttbCode && <Field icon={<ShieldCheck size={13} />} label="Kredi">{c.cmeCredit}</Field>}
          {slugs.length > 0 && (
            <Field icon={<Globe size={13} />} label="İlgili branşlar">
              {slugs.map((s) => branchLabel(s) ?? s).join(" · ")}
            </Field>
          )}
        </dl>

        {/* ── Kayıt koşulları ── */}
        {c.registrationNotes && (
          <section className="border-t border-[var(--c-hairline)] px-5 py-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
              Kayıt ve katılım koşulları
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[var(--c-ink-2)]">
              {c.registrationNotes}
            </p>
          </section>
        )}

        {c.themes && (
          <section className="border-t border-[var(--c-hairline)] px-5 py-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">Ana temalar</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink-2)]">{c.themes}</p>
          </section>
        )}

        {/* ── TTB STE/SMG akreditasyonu (kullanıcı isteği 2026-08-19): künyedeki satırdan kendi
            bölümüne yükseldi — Eylemler'deki "Takvime ekle" düğme diliyle iki dış bağlantı.
            Kredi SAYISI YAZILMAZ (EK-1: 40 dk = 1 kredi, günde ≤6 — puan katılım süresine göre
            TTB kaydında oluşur; [[public-claim-honesty]]: ölçülmemiş sayı iddiası yok).
            Bkz. vault output/ste-kredilendirme-arastirmasi-2026-08-19.md §6. */}
        {c.ttbCode && (
          <section className="border-t border-[var(--c-hairline)] px-5 py-4">
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
              <ShieldCheck size={13} className="text-emerald-400" /> TTB STE/SMG Akreditasyonu
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink-2)]">
              Bu etkinlik Türk Tabipleri Birliği STE/SMG kredilendirme sisteminde{" "}
              <span className="aura-mono font-semibold text-[var(--c-ink)]">{c.ttbCode}</span> koduyla
              kayıtlıdır. Kredi puanınız katıldığınız süreye göre TTB kaydınızda oluşur — bu sayfa
              kredi tutarı bildirmez.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href="https://kredilendirme.ttb.dr.tr/etkinlik_bul.php" target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3.5 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]">
                <ExternalLink size={13} /> Etkinliğin TTB kaydı
              </a>
              <a href="https://kredilendirme.ttb.dr.tr/katilimci.php" target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3.5 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]">
                <ExternalLink size={13} /> Kredi puanlarım (TTB)
              </a>
            </div>
          </section>
        )}

        {/* ── Eylemler ── */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--c-hairline)] px-5 py-4">
          {c.url && (
            <a href={c.url} target="_blank" rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#062a20] hover:bg-emerald-400">
              <ExternalLink size={13} /> Resmî siteye git
            </a>
          )}
          {/* Takvime ekle (v6.143): .ics indirmesi yerine Doctorium'un KENDİ takvimine ekler —
              CongressFollow'u açar, /doktor/doctorium/takvim takipten türediği için etkinlik
              oraya kendiliğinden düşer (kullanıcı bildirimi: iki ayrı "takvim" kafa karıştırıyordu).
              doctorId'siz personel (COORDINATOR/ADMIN) takip edemez — üstteki chip'le aynı kapı. */}
          {doctorId && (
            <FollowButton key={String(following)} congressId={c.id} following={following} variant="action" />
          )}
        </div>

        {/* ── Şeffaflık: bu bilgi nereden geliyor, ne zaman doğrulandı ── */}
        <footer className="border-t border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-5 py-3 text-[11px] text-[var(--c-ink-3)]">
          <p>
            {c.confidence === "kismi"
              ? "⚠️ Bu kaydın bir kısmı doğrulanamadı (sonraki edisyon henüz ilan edilmemiş olabilir). "
              : ""}
            Kayıt ücretleri ve tarihler değişebilir — <strong className="text-[var(--c-ink-2)]">katılmadan önce
            resmî siteden teyit edin</strong>.
            {c.verifiedAt && ` Son doğrulama: ${fmt(c.verifiedAt)}.`}
          </p>
          {sources.length > 0 && (
            <p className="mt-1">
              Kaynaklar:{" "}
              {sources.map((u, i) => (
                <span key={u}>
                  {i > 0 && " · "}
                  <a href={u} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-[var(--c-ink-2)]">
                    {hostOf(u)}
                  </a>
                </span>
              ))}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
        {icon} {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[var(--c-ink)]">{children}</dd>
    </div>
  );
}

function fmt(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function hostOf(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u.slice(0, 40);
  }
}

/** JSON string[] alanını güvenle çözer (bozuk veri sayfayı düşürmesin). */
function safeSlugs(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

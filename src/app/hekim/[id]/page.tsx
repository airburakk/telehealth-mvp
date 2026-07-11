import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { countryFlag, formatDateTime, VIDEO_CARD_SCRIPT } from "@/lib/constants";
import { doctorCredentials, richBio, academicNote, generatedReviews, avatarVariant, isFemaleName } from "@/lib/doctor-profile";
import { DoctorVideoCard } from "@/components/DoctorVideoCard";
import { DoctorArt } from "@/components/PortamedArt";
import { BadgeCheck, Star, Globe, GraduationCap, ShieldCheck, Video, MapPin, ArrowLeft, CheckCircle2, Stethoscope, Award, Heart, Zap, Activity, type LucideIcon } from "lucide-react";
import { getDoctorBadges } from "@/lib/match-score";

export const dynamic = "force-dynamic";

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={15} className={i < full ? "fill-amber-400 text-amber-400" : "text-white/20"} />
      ))}
    </span>
  );
}

export default async function DoctorProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db.doctor.findUnique({ where: { id } });
  // Vitrin dürüstlüğü: onaylanmamış (verified=false) doktor public profilde YOK — dizin zaten gizliyordu,
  // public URL de aynı davranır; admin onayı gelince sayfa açılır.
  if (!d || !d.verified) notFound();

  // Profil zenginleştirme — render-zamanı deterministik üretim (şema/DB yok); mevcut bio korunur
  const cred = doctorCredentials(d);
  // Yorumlar: kalıcı Review tablosundan; yoksa deterministik üretim fallback (geriye uyumlu).
  const dbReviews = await db.review.findMany({ where: { doctorId: d.id }, orderBy: { createdAt: "desc" } });
  // generated: false = gerçek DB yorumu ("Doğrulanmış" çipi yalnız bunlarda); true = üretilmiş örnek içerik.
  const reviews = dbReviews.length
    ? dbReviews.map((r) => ({ author: r.author, country: r.country, stars: r.stars, text: r.text, daysAgo: Math.max(1, Math.round((Date.now() - r.createdAt.getTime()) / 86400000)), generated: false }))
    : generatedReviews(d);
  const bioText = richBio(d, d.bio);
  const badges = await getDoctorBadges(d.id); // CRM eşik-bazlı public güven rozetleri (ham skor değil)

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[#0D0E10]">
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/hekimler" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-[#28C8D8]">
        <ArrowLeft size={16} /> Doktorlar
      </Link>

      {/* Hero */}
      <div className="mt-4 rounded-[22px] border border-white/10 bg-[#161719] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="h-20 w-20 shrink-0 overflow-hidden rounded-3xl ring-1 ring-white/15"><DoctorArt i={avatarVariant(d.name)} female={isFemaleName(d.name)} photo={d.photo} /></span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#F4F5F3]">{d.title} {d.name}</h1>
              {d.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#28C8D8]/15 px-2.5 py-1 text-xs font-semibold text-[#28C8D8]"><BadgeCheck size={14} /> Doğrulanmış</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
              <span className="inline-flex items-center gap-1 font-medium text-[#28C8D8]"><Stethoscope size={14} /> {d.branch}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {d.city}</span>
              <span className="inline-flex items-center gap-1"><Globe size={14} /> {d.languages.split(",").join(" · ")}</span>
            </div>
            {/* Yıldız satırı yalnız gerçek rating verisi varken (null = veri yok → "0.0 yıldız" göstermek yanıltıcı) */}
            {d.rating != null && (
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-sm"><Stars value={d.rating} /> <span className="font-semibold text-white/80">{d.rating.toFixed(1)}</span> <span className="text-white/40">({reviews.length} yorum)</span></span>
              </div>
            )}

            {badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {badges.map((b) => {
                  const Icon = BADGE_ICON[b.key] ?? CheckCircle2;
                  const style = BADGE_STYLE[b.key] ?? "bg-white/5 text-white/70 ring-white/15";
                  return (
                    <span
                      key={b.key}
                      aria-label={`${b.label}: ${b.desc}`}
                      className={`group relative inline-flex cursor-default items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${style}`}
                    >
                      <Icon size={13} /> {b.label}
                      {/* Hover açıklama balonu (CSS-only; mouse ile üzerine gelince) */}
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-[#26272B] px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white/90 shadow-lg ring-1 ring-white/10 group-hover:block"
                      >
                        {b.desc}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Stats — değere göre renklenen çubuklar (slider görünümü); null = veri yok → çubuk hiç çizilmez */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {d.experienceYears != null && <StatBar label="Deneyim" valueText={`${d.experienceYears} yıl`} pct={(d.experienceYears / 30) * 100} />}
          {d.successRate != null && <StatBar label="Başarı oranı" valueText={`%${d.successRate}`} pct={d.successRate} />}
          <StatBar label="Aylık kapasite" valueText={`${d.capacity}`} pct={(d.capacity / 40) * 100} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card title="Hakkında">
            <p className="text-sm leading-relaxed text-white/70">{bioText}</p>
          </Card>

          <Card title="Hasta Yorumları" icon={<Star size={15} />}>
            <ul className="space-y-3">
              {reviews.map((r, i) => (
                <li key={i} className="rounded-2xl border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">{countryFlag(r.country)} {r.author}</span>
                    {/* "Doğrulanmış" çipi yalnız gerçek DB yorumlarında; üretilmiş içerik açıkça etiketlenir */}
                    {r.generated ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/40">Örnek değerlendirme</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300"><CheckCircle2 size={12} /> Doğrulanmış</span>
                    )}
                  </div>
                  <div className="mt-1"><Stars value={r.stars} /></div>
                  <p className="mt-1.5 text-sm text-white/60">{r.text}</p>
                  <div className="mt-1 text-[11px] text-white/35">{formatDateTime(new Date(Date.now() - r.daysAgo * 86400000))}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="Video Kartvizit" icon={<Video size={15} />}>
            <DoctorVideoCard name={d.name} title={d.title} female={isFemaleName(d.name)} subtitles={[...VIDEO_CARD_SCRIPT]} />
          </Card>

          <Card title="Akreditasyon & Belgeler" icon={<ShieldCheck size={15} />}>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-medium text-white/75">Tıp Diploması</div>
                  {/* Yıl yalnız gerçek veriden türetilebildiyse (null = fabrikasyon yok) */}
                  <div className="text-xs text-white/45">{cred.diploma.school}{cred.diploma.year != null && ` · ${cred.diploma.year}`}</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-medium text-white/75">Uzmanlık Belgesi</div>
                  <div className="text-xs text-white/45">{cred.uzmanlik.board}{cred.uzmanlik.year != null && ` · ${cred.uzmanlik.year}`}</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-medium text-white/75">Mesleki Sertifikalar</div>
                  <ul className="mt-0.5 space-y-0.5 text-xs text-white/45">
                    {cred.certs.map((c) => <li key={c}>• {c}</li>)}
                  </ul>
                </div>
              </li>
              <li aria-hidden className="mt-1 border-t border-white/10 pt-1" />
              {/* JCI satırı yalnız doğrulanmış akreditasyonda — false/null "veri yok"tur, olumsuz beyan değil (üstü çizili negatif sinyal kaldırıldı) */}
              {d.jci === true && <Cred ok label="JCI akrediteli merkez" />}
              <Cred ok={d.verified} label="Sağlık Turizmi Yetki Belgesi" />
            </ul>
          </Card>

          <Card title="Akademik" icon={<GraduationCap size={15} />}>
            <p className="text-sm leading-relaxed text-white/60">{academicNote(d)}</p>
          </Card>

          <Link href="/triyaj" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            <Stethoscope size={16} /> Bu branşta görüşme planla
          </Link>
        </aside>
      </div>
    </div>
    </div>
  );
}

const BADGE_ICON: Record<string, LucideIcon> = {
  rating: Star,
  volume: Award,
  freeCare: Heart,
  responsiveness: Zap,
  reliability: ShieldCheck,
  recency: Activity,
};
// Anlam-bazlı pastel renk (her rozet ayrı tanınsın; bg-50/text-700/ring-200 tutarlı şekil)
const BADGE_STYLE: Record<string, string> = {
  rating: "bg-amber-500/10 text-amber-300 ring-amber-400/25",
  volume: "bg-indigo-500/10 text-indigo-300 ring-indigo-400/25",
  freeCare: "bg-rose-500/10 text-rose-300 ring-rose-400/25",
  responsiveness: "bg-violet-500/10 text-violet-300 ring-violet-400/25",
  reliability: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
  recency: "bg-cyan-500/10 text-cyan-300 ring-cyan-400/25",
};

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#161719] p-5">
      <div className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wide text-white/45">{icon} {title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function StatBar({ label, valueText, pct }: { label: string; valueText: string; pct: number }) {
  const p = Math.max(6, Math.min(100, Math.round(pct)));
  const hue = Math.round(40 + (p / 100) * 120); // 40 amber (düşük) → 160 teal/yeşil (yüksek)
  return (
    <div className="rounded-2xl bg-[#1E1F22] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-lg font-bold text-[#F4F5F3]">{valueText}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: `hsl(${hue} 65% 55%)` }} />
      </div>
    </div>
  );
}
function Cred({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 size={15} className={ok ? "text-emerald-400" : "text-white/25"} />
      <span className={ok ? "text-white/75" : "text-white/35 line-through"}>{label}</span>
    </li>
  );
}

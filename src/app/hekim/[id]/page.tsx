import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { countryFlag, formatDateTime } from "@/lib/constants";
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
        <Star key={i} size={15} className={i < full ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
      ))}
    </span>
  );
}

export default async function DoctorProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db.doctor.findUnique({ where: { id } });
  if (!d) notFound();

  // Profil zenginleştirme — render-zamanı deterministik üretim (şema/DB yok); mevcut bio korunur
  const cred = doctorCredentials(d);
  const reviews = generatedReviews(d);
  const bioText = richBio(d, d.bio);
  const badges = await getDoctorBadges(d.id); // CRM eşik-bazlı public güven rozetleri (ham skor değil)

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/hekimler" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5B2]">
        <ArrowLeft size={16} /> Hekimler
      </Link>

      {/* Hero */}
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="h-20 w-20 shrink-0 overflow-hidden rounded-3xl ring-1 ring-slate-200"><DoctorArt i={avatarVariant(d.name)} female={isFemaleName(d.name)} /></span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">{d.title} {d.name}</h1>
              {d.verified && <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700"><BadgeCheck size={14} /> Doğrulanmış</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-[#0EA5B2]"><Stethoscope size={14} /> {d.branch}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {d.city}</span>
              <span className="inline-flex items-center gap-1"><Globe size={14} /> {d.languages.split(",").join(" · ")}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-sm"><Stars value={d.rating} /> <span className="font-semibold text-slate-700">{d.rating.toFixed(1)}</span> <span className="text-slate-400">({reviews.length} yorum)</span></span>
            </div>

            {badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {badges.map((b) => {
                  const Icon = BADGE_ICON[b.key] ?? CheckCircle2;
                  const style = BADGE_STYLE[b.key] ?? "bg-slate-50 text-slate-700 ring-slate-200";
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
                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg group-hover:block"
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

        {/* Stats — değere göre renklenen çubuklar (slider görünümü) */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatBar label="Deneyim" valueText={`${d.experienceYears} yıl`} pct={(d.experienceYears / 30) * 100} />
          <StatBar label="Başarı oranı" valueText={`%${d.successRate}`} pct={d.successRate} />
          <StatBar label="Aylık kapasite" valueText={`${d.capacity}`} pct={(d.capacity / 40) * 100} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card title="Hakkında">
            <p className="text-sm leading-relaxed text-slate-700">{bioText}</p>
          </Card>

          <Card title="Hasta Yorumları" icon={<Star size={15} />}>
            <ul className="space-y-3">
              {reviews.map((r, i) => (
                <li key={i} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{countryFlag(r.country)} {r.author}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 size={12} /> Doğrulanmış</span>
                  </div>
                  <div className="mt-1"><Stars value={r.stars} /></div>
                  <p className="mt-1.5 text-sm text-slate-600">{r.text}</p>
                  <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(new Date(Date.now() - r.daysAgo * 86400000))}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="Video Kartvizit" icon={<Video size={15} />}>
            <DoctorVideoCard
              name={d.name}
              title={d.title}
              branch={d.branch}
              city={d.city}
              color={d.color}
              tagline={`${d.jci ? "JCI akrediteli · " : ""}${d.experienceYears} yıl deneyim · ${d.languages.split(",").join(" / ")}`}
            />
          </Card>

          <Card title="Akreditasyon & Belgeler" icon={<ShieldCheck size={15} />}>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <div className="font-medium text-slate-700">Tıp Diploması</div>
                  <div className="text-xs text-slate-500">{cred.diploma.school} · {cred.diploma.year}</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <div className="font-medium text-slate-700">Uzmanlık Belgesi</div>
                  <div className="text-xs text-slate-500">{cred.uzmanlik.board} · {cred.uzmanlik.year}</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <div className="font-medium text-slate-700">Mesleki Sertifikalar</div>
                  <ul className="mt-0.5 space-y-0.5 text-xs text-slate-500">
                    {cred.certs.map((c) => <li key={c}>• {c}</li>)}
                  </ul>
                </div>
              </li>
              <li aria-hidden className="mt-1 border-t border-slate-100 pt-1" />
              <Cred ok={d.jci} label="JCI akrediteli merkez" />
              <Cred ok={d.verified} label="Sağlık Turizmi Yetki Belgesi" />
            </ul>
          </Card>

          <Card title="Akademik" icon={<GraduationCap size={15} />}>
            <p className="text-sm leading-relaxed text-slate-600">{academicNote(d)}</p>
          </Card>

          <Link href="/triyaj" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
            <Stethoscope size={16} /> Bu branşta görüşme planla
          </Link>
        </aside>
      </div>
    </div>
  );
}

const BADGE_ICON: Record<string, LucideIcon> = {
  rating: Star,
  volume: Award,
  proBono: Heart,
  responsiveness: Zap,
  reliability: ShieldCheck,
  recency: Activity,
};
// Anlam-bazlı pastel renk (her rozet ayrı tanınsın; bg-50/text-700/ring-200 tutarlı şekil)
const BADGE_STYLE: Record<string, string> = {
  rating: "bg-amber-50 text-amber-700 ring-amber-200",
  volume: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  proBono: "bg-rose-50 text-rose-700 ring-rose-200",
  responsiveness: "bg-violet-50 text-violet-700 ring-violet-200",
  reliability: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  recency: "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon} {title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function StatBar({ label, valueText, pct }: { label: string; valueText: string; pct: number }) {
  const p = Math.max(6, Math.min(100, Math.round(pct)));
  const hue = Math.round(40 + (p / 100) * 120); // 40 amber (düşük) → 160 teal/yeşil (yüksek)
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-lg font-bold text-[#101010]">{valueText}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: `hsl(${hue} 65% 45%)` }} />
      </div>
    </div>
  );
}
function Cred({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 size={15} className={ok ? "text-emerald-600" : "text-slate-300"} />
      <span className={ok ? "text-slate-700" : "text-slate-400 line-through"}>{label}</span>
    </li>
  );
}

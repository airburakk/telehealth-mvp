import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { countryFlag, formatDateTime } from "@/lib/constants";
import { BadgeCheck, Star, Globe, GraduationCap, ShieldCheck, Video, MapPin, ArrowLeft, CheckCircle2, Stethoscope } from "lucide-react";

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
  const d = await db.doctor.findUnique({ where: { id }, include: { reviews: { orderBy: { createdAt: "desc" } } } });
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/hekimler" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A7D77]">
        <ArrowLeft size={16} /> Hekimler
      </Link>

      {/* Hero */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-3xl font-bold text-white" style={{ background: d.color }}>{d.name.slice(0, 1)}</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">{d.title} {d.name}</h1>
              {d.verified && <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700"><BadgeCheck size={14} /> Doğrulanmış</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-[#0A7D77]"><Stethoscope size={14} /> {d.branch}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {d.city}</span>
              <span className="inline-flex items-center gap-1"><Globe size={14} /> {d.languages.split(",").join(" · ")}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-sm"><Stars value={d.rating} /> <span className="font-semibold text-slate-700">{d.rating.toFixed(1)}</span> <span className="text-slate-400">({d.reviews.length} yorum)</span></span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat value={`${d.experienceYears}`} label="yıl deneyim" />
          <Stat value={`%${d.successRate}`} label="başarı oranı" />
          <Stat value={`${d.capacity}`} label="aylık kapasite" />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {d.bio && (
            <Card title="Hakkında">
              <p className="text-sm leading-relaxed text-slate-700">{d.bio}</p>
            </Card>
          )}

          <Card title="Hasta Yorumları" icon={<Star size={15} />}>
            {d.reviews.length === 0 ? (
              <p className="text-sm text-slate-400">Henüz yorum yok.</p>
            ) : (
              <ul className="space-y-3">
                {d.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{countryFlag(r.country)} {r.author}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 size={12} /> Doğrulanmış</span>
                    </div>
                    <div className="mt-1"><Stars value={r.stars} /></div>
                    <p className="mt-1.5 text-sm text-slate-600">{r.text}</p>
                    <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(r.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="Video Kartvizit" icon={<Video size={15} />}>
            <div className="grid aspect-video place-items-center rounded-xl bg-slate-900 text-center text-xs text-white/60">
              <div><Video size={22} className="mx-auto mb-1" /> 60 sn tanıtım (demo)</div>
            </div>
          </Card>

          <Card title="Akreditasyon & Belgeler" icon={<ShieldCheck size={15} />}>
            <ul className="space-y-2 text-sm">
              <Cred ok={d.jci} label="JCI akrediteli merkez" />
              <Cred ok={d.verified} label="Sağlık Turizmi Yetki Belgesi" />
              <Cred ok label="Sağlık Bakanlığı onaylı diploma" />
            </ul>
          </Card>

          <Card title="Akademik" icon={<GraduationCap size={15} />}>
            <p className="text-sm text-slate-600">Tıp fakültesi mezunu, uluslararası kongre ve yayın deneyimi.</p>
          </Card>

          <Link href="/triyaj" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E9E97] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A7D77]">
            <Stethoscope size={16} /> Bu branşta görüşme planla
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon} {title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="text-xl font-bold text-[#0A3F39]">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
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

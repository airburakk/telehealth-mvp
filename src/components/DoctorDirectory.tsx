"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Star, BadgeCheck, Globe, ArrowRight, Inbox } from "lucide-react";
import { DoctorArt } from "@/components/PortamedArt";
import { avatarVariant, isFemaleName } from "@/lib/doctor-profile";

export interface DoctorRow {
  id: string;
  name: string;
  title: string;
  branch: string;
  city: string;
  languages: string;
  rating: number;
  experienceYears: number;
  successRate: number;
  verified: boolean;
  color: string;
  reviews: number;
}

export function DoctorDirectory({ doctors }: { doctors: DoctorRow[] }) {
  const [branch, setBranch] = useState("all");
  const [q, setQ] = useState("");
  const branches = useMemo(() => Array.from(new Set(doctors.map((d) => d.branch))).sort(), [doctors]);
  const filtered = doctors.filter(
    (d) => (branch === "all" || d.branch === branch) && (q === "" || d.name.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")))
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hekim ara…" className="rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#14C3D0]" />
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#14C3D0]">
          <option value="all">Tüm branşlar</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
            <Inbox className="mx-auto mb-2" /> Hekim bulunamadı.
          </div>
        )}
        {filtered.map((d) => (
          <Link key={d.id} href={`/hekim/${d.id}`} className="group rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-[#14C3D0]/30 hover:shadow-sm">
            <div className="flex items-start gap-3">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-200"><DoctorArt i={avatarVariant(d.name)} female={isFemaleName(d.name)} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800">{d.title} {d.name}</span>
                  {d.verified && <BadgeCheck size={16} className="text-teal-600" />}
                </div>
                <div className="text-sm font-medium text-[#0EA5B2]">{d.branch}</div>
                <div className="mt-0.5 text-xs text-slate-500">{d.city}</div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0EA5B2]" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><Star size={13} className="fill-amber-400 text-amber-400" /> {d.rating.toFixed(1)}</span>
              <span>{d.experienceYears} yıl deneyim</span>
              <span>%{d.successRate} başarı</span>
              <span>{d.reviews} yorum</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Globe size={13} /> {d.languages.split(",").join(" · ")}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

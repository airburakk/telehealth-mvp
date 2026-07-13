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
  // null = "veri yok" → ilgili satır UI'da GİZLENİR (0 göstermek pazarlama-yanlış olur)
  rating: number | null;
  experienceYears: number | null;
  successRate: number | null;
  verified: boolean;
  color: string;
  reviews: number;
  photo?: string | null;
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
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-ink-3)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Doktor ara…" className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] py-2 pl-9 pr-3 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]" />
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]">
          <option value="all">Tüm branşlar</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
            <Inbox className="mx-auto mb-2" /> Doktor bulunamadı.
          </div>
        )}
        {filtered.map((d) => (
          <Link key={d.id} href={`/hekim/${d.id}`} className="group rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 transition hover:border-[var(--c-accent)]/40">
            <div className="flex items-start gap-3">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15"><DoctorArt i={avatarVariant(d.name)} female={isFemaleName(d.name)} photo={d.photo} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[var(--c-ink)]">{d.title} {d.name}</span>
                  {d.verified && <BadgeCheck size={16} className="text-[var(--c-accent)]" />}
                </div>
                <div className="text-sm font-medium text-[var(--c-accent)]">{d.branch}</div>
                <div className="mt-0.5 text-xs text-[var(--c-ink-3)]">{d.city}</div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-[var(--c-ink-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--c-accent)]" />
            </div>
            {/* null = veri yok → o metrik satırı gizlenir (yeni self-signup doktor "0.0 yıldız" ile doğmasın) */}
            {(d.rating != null || d.experienceYears != null || d.successRate != null || d.reviews > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--c-ink-3)]">
                {d.rating != null && <span className="inline-flex items-center gap-1 font-semibold text-amber-300"><Star size={13} className="fill-amber-400 text-amber-400" /> {d.rating.toFixed(1)}</span>}
                {d.experienceYears != null && <span>{d.experienceYears} yıl deneyim</span>}
                {d.successRate != null && <span>%{d.successRate} başarı</span>}
                {d.reviews > 0 && <span>{d.reviews} yorum</span>}
              </div>
            )}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--c-ink-3)]">
              <Globe size={13} /> {d.languages.split(",").join(" · ")}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

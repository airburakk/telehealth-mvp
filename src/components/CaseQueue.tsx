"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { urgencyStyle, CASE_STATUS, countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { Search, ArrowRight, Inbox } from "lucide-react";

export interface CaseRow {
  id: string;
  patientName: string;
  country: string;
  language: string;
  branch: string;
  urgency: number;
  status: string;
  createdAt: string;
  doctorName: string | null;
  hasFiles: boolean;
}

export function CaseQueue({ rows }: { rows: CaseRow[] }) {
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const branches = useMemo(() => Array.from(new Set(rows.map((r) => r.branch))).sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (branch === "all" || r.branch === branch) &&
          (status === "all" || r.status === status) &&
          (q === "" || r.patientName.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")))
      ),
    [rows, branch, status, q]
  );

  const urgent = rows.filter((r) => r.urgency >= 4).length;
  const waiting = rows.filter((r) => r.status === "NEW").length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Toplam vaka" value={rows.length} />
        <Stat label="Bekleyen" value={waiting} tone="text-blue-700" />
        <Stat label="Acil (4-5)" value={urgent} tone="text-red-600" />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hasta ara…"
            className="rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#14C3D0]"
          />
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#14C3D0]">
          <option value="all">Tüm branşlar</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#14C3D0]">
          <option value="all">Tüm durumlar</option>
          {Object.entries(CASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2.5">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
            <Inbox className="mx-auto mb-2" /> Eşleşen vaka yok.
          </div>
        )}
        {filtered.map((r) => {
          const u = urgencyStyle(r.urgency);
          const st = CASE_STATUS[r.status] ?? CASE_STATUS.NEW;
          return (
            <Link
              key={r.id}
              href={`/doktor/vaka/${r.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#14C3D0]/30 hover:shadow-sm"
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold ring-1 ${u.badge}`}>
                {r.urgency}
                <span className="text-[8px] font-medium -mt-1">/5</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{r.patientName}</span>
                  <span className="text-xs text-slate-400">{countryFlag(r.country)} {countryName(r.country)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
                  <span className="font-medium text-[#0EA5B2]">{r.branch}</span>
                  <span>·</span>
                  <span>{formatDateTime(r.createdAt)}</span>
                  {r.hasFiles && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">📎 dosya</span>}
                </div>
              </div>
              <span className={`hidden sm:inline rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>
              <ArrowRight size={18} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0EA5B2]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className={`text-2xl font-bold ${tone ?? "text-[#101010]"}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

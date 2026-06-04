import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { UserRound, Stethoscope, ArrowRight, ShieldCheck, Languages, Video, ClipboardList } from "lucide-react";

const MODULES = [
  { n: "1", t: "Triyaj", d: "Semptom + dosya → branş & aciliyet (1-5)" },
  { n: "2", t: "Video Görüşme", d: "Asimetrik arayüz, vaka özeti, not paneli" },
  { n: "3", t: "Sağlık Turizmi", d: "Paket, sigorta, lojistik, Escrow" },
  { n: "4", t: "Post-Op Takip", d: "İyileşme takibi, kırmızı bayrak, kontrol" },
  { n: "5", t: "Doktor & Klinik", d: "Panel, kapasite, hakediş, itibar" },
  { n: "6", t: "Doktor Tanıtım", d: "Doğrulanmış profil, yorumlar, akademik" },
  { n: "7", t: "Etik Kurul", d: "Tahkim, anonim inceleme, Escrow iade" },
];

export default async function Home() {
  const user = await getCurrentUser();
  const patientHref = user ? "/triyaj" : "/giris";
  const doctorHref = user ? "/doktor" : "/giris";
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-[#0f2a4a] to-[#143a63] text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-sky-100 ring-1 ring-white/15">
            AIR TELEHEALTH · MVP
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            Sağlık turizmi için uçtan uca dijital platform
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-sky-100/90">
            Hasta semptomlarını akıllı triyajla doğru uzmana yönlendirir, tıbbi dosyaları hazır vaka
            kartına dönüştürür ve video görüşmeyle buluşturur.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 max-w-3xl">
            <Link
              href={patientHref}
              className="group rounded-2xl bg-white p-6 text-slate-900 shadow-lg ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-100 text-sky-700">
                  <UserRound size={22} />
                </span>
                <div>
                  <div className="font-semibold text-[#0f2a4a]">Hastayım</div>
                  <div className="text-sm text-slate-500">Triyaj sürecini başlat</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-sky-700">
                Şikayetimi anlat <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href={doctorHref}
              className="group rounded-2xl bg-white p-6 text-slate-900 shadow-lg ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Stethoscope size={22} />
                </span>
                <div>
                  <div className="font-semibold text-[#0f2a4a]">Doktorum</div>
                  <div className="text-sm text-slate-500">Vaka kuyruğunu gör</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-700">
                Doktor paneline git <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sky-100/80">
            <span className="inline-flex items-center gap-1.5"><ClipboardList size={15} /> Akıllı triyaj</span>
            <span className="inline-flex items-center gap-1.5"><Languages size={15} /> Çok dilli</span>
            <span className="inline-flex items-center gap-1.5"><Video size={15} /> Video görüşme</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} /> KVKK/GDPR uyumlu</span>
          </div>
        </div>
      </section>

      {/* Modüller */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-xl font-bold text-[#0f2a4a]">Ekosistem · 7 Modül</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bu MVP&apos;de <strong className="text-slate-700">7 modülün tamamı</strong> uçtan uca çalışır durumda.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => {
            const live = true;
            return (
              <div
                key={m.n}
                className={`rounded-xl border p-4 ${live ? "border-sky-200 bg-sky-50/50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${live ? "bg-[#0f2a4a] text-white" : "bg-slate-200 text-slate-600"}`}>
                    {m.n}
                  </span>
                  {live && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">AKTİF</span>}
                </div>
                <div className="mt-2.5 font-semibold text-slate-800">{m.t}</div>
                <div className="text-xs text-slate-500">{m.d}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

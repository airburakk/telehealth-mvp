import Link from "next/link";
import { Stethoscope, FileSearch, Languages, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

export const metadata = { title: "İkinci Görüş — AURA" };

const STEPS = [
  { icon: FileSearch, t: "Kayıtlarınızı paylaşın", d: "Mevcut tanı, görüntüleme ve raporlarınızı güvenle yükleyin." },
  { icon: Stethoscope, t: "Uzman değerlendirir", d: "Akredite bir uzman dosyanızı bağımsız olarak inceler." },
  { icon: Languages, t: "Video görüşme", d: "70 dilde simültane tercümeyle uzmanla yüz yüze görüşün." },
  { icon: ShieldCheck, t: "Yazılı ikinci görüş", d: "Kararınız için bağımsız, belgeli bir değerlendirme alın." },
];

export default function SecondOpinionPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <span className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0]/10 px-4 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#0E8A95]">
        <Stethoscope size={15} /> İkinci Görüş
      </span>
      <h1 className="mt-5 text-3xl font-bold leading-tight text-[#101010] sm:text-[40px]">
        Tanınızdan emin olun — akredite uzmanlardan bağımsız ikinci görüş.
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-600">
        Mevcut tanı ve tedavinizi, alanında akredite bir uzmanın gözünden değerlendirin.
        70 dilde simültane tercüme hizmetiyle uzmanla doğrudan video görüşün; kararınızı güvenle verin.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/giris?next=/triyaj" className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0] px-6 py-3 text-[15px] font-semibold text-[#101010] hover:bg-[#0EA5B2]">
          Hemen başla <ArrowRight size={17} />
        </Link>
        <Link href="/hekimler" className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
          Uzmanları gör
        </Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.t} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Icon size={20} /></span>
              <div className="mt-3 text-[11px] font-bold text-[#14C3D0]">0{i + 1}</div>
              <div className="mt-1 font-semibold text-[#101010]">{s.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.d}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-3xl border border-[#14C3D0]/25 bg-[#14C3D0]/[0.06] p-5 text-sm text-slate-600">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#0E8A95]" />
        İkinci görüş bağlayıcı değildir ve mevcut tedavinizin yerine geçmez. Amaç, kararınızı bağımsız bir uzman değerlendirmesiyle desteklemektir.
      </div>
    </div>
  );
}

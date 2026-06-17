import Link from "next/link";
import { HeartHandshake, Users, FileCheck2, ShieldCheck, ArrowRight, Info } from "lucide-react";

export const metadata = { title: "Pro Bono — AURA" };

const POINTS = [
  { icon: Users, t: "Kimler için?", d: "Maddi imkânı kısıtlı, tedaviye erişimi zor hastalar ve dezavantajlı gruplar." },
  { icon: FileCheck2, t: "Nasıl başvurulur?", d: "Kısa bir ön değerlendirme doldurun; durumunuz gönüllü hekim havuzuna iletilir." },
  { icon: HeartHandshake, t: "Gönüllü hekimler", d: "Akredite uzmanlarımız her dönem belirli bir kontenjanı ücretsiz konsültasyona ayırır." },
  { icon: ShieldCheck, t: "Aynı standart", d: "Pro Bono görüşmeler de 70 dilde tercüme ve tam gizlilikle yürütülür." },
];

export default function ProBonoPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <span className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0]/10 px-4 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#0E8A95]">
        <HeartHandshake size={15} /> Pro Bono
      </span>
      <h1 className="mt-5 text-3xl font-bold leading-tight text-[#101010] sm:text-[40px]">
        Sağlığa erişim bir ayrıcalık değil, haktır.
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-600">
        AURA Pro Bono programı, maddi imkânı kısıtlı hastalar için akredite uzmanlarla
        <strong className="font-semibold text-slate-800"> ücretsiz</strong> video konsültasyon sunar.
        Gönüllü hekimlerimiz her dönem belirli bir kontenjanı bu amaca ayırır.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/giris?next=/triyaj" className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0] px-6 py-3 text-[15px] font-semibold text-[#101010] hover:bg-[#0EA5B2]">
          Başvur <ArrowRight size={17} />
        </Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {POINTS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.t} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Icon size={20} /></span>
              <div className="mt-3 font-semibold text-[#101010]">{p.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{p.d}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
        Kontenjan sınırlıdır ve başvurular ön değerlendirmeye tabidir. Başvurunuz, uygunluk açısından koordinasyon ekibimizce incelenir.
      </div>
    </div>
  );
}

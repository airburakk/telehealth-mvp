"use client";
import dynamic from "next/dynamic";
import type { TusChartsProps } from "./TusCharts";

// Recharts yalnız tarayıcıda ölçüm yapabilir (ResponsiveContainer) → ssr:false; `ssr:false` yalnız client bileşende geçerli
// olduğu için bu ince sarmalayıcı var. Yükleme hâli grafik kartlarıyla aynı yükseklikte (düzen zıplamasın).
const TusCharts = dynamic(() => import("./TusCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Grafikler yükleniyor">
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[19rem] animate-pulse rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]" />)}
    </div>
  ),
});

export default function TusChartsLoader(props: TusChartsProps) {
  return <TusCharts {...props} />;
}

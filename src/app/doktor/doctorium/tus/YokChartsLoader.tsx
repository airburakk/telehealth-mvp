"use client";
import dynamic from "next/dynamic";
import type { YokChartsProps } from "./YokCharts";

// Recharts yalnız client'ta (SSR'da ResponsiveContainer ölçüsüz). Sunucu bileşeni bu sarmalayıcıyı çağırır (TusChartsLoader ile aynı desen).
const YokCharts = dynamic(() => import("./YokCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Grafikler yükleniyor">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]" />)}
    </div>
  ),
});

export default function YokChartsLoader(props: YokChartsProps) {
  return <YokCharts {...props} />;
}

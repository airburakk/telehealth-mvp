import { FreeCareWaitingInner } from "./FreeCareWaitingInner";

// force-dynamic ZORUNLU (2026-08-28 denetimi) — bkz. src/app/giris/page.tsx aynı not: kök
// layout artık cookies() çağırmadığından bu sayfa statik prerender'a düşüp içerik hiç SSR'de
// gelmiyordu. "use client" bir page.tsx'te dynamic export SESSİZCE yok sayılıyordu (build
// çıktısında ○ Static olarak kaldı) → sayfa SERVER component'e indirgendi, tüm client mantığı
// FreeCareWaitingInner.tsx'e taşındı (Suspense'e de gerek kalmadı — bkz. o dosyanın notu).
export const dynamic = "force-dynamic";

export default function FreeCareWaitingPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <FreeCareWaitingInner />
    </div>
  );
}

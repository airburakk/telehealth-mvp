"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { AuraButton } from "@/components/ui/AuraButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// "Tüm cihazlardan çıkış" — Header hesap menüsündeki eylemin panel karşılığı (v6.184).
// Aynı uca gider (/api/auth/logout-all → User.sessionVersion++): dolaşımdaki TÜM token'lar bayatlar,
// bu cihazın çerezi de silinir. Giriş etkinliği panelinin altında yaşar çünkü listede tanınmayan bir
// giriş görmenin doğal karşılığı budur.
export function LogoutAllButton({ target }: { target: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    await fetch("/api/auth/logout-all", { method: "POST" }).catch(() => null);
    router.replace(target);
    router.refresh(); // replace tek başına bayat RSC cache'i kullanabilir
  }

  return (
    <>
      <AuraButton variant="secondary" onClick={() => setOpen(true)}>
        <ShieldOff size={16} /> Tüm cihazlardan çıkış
      </AuraButton>
      <ConfirmDialog
        open={open}
        message="Tüm cihazlardaki oturumlarınız kapatılacak. Devam edilsin mi?"
        confirmLabel="Tüm cihazlardan çıkış"
        cancelLabel="Vazgeç"
        danger
        busy={busy}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

"use client";

// "Şimdi" ve tarayıcı saat dilimi — render'da Date.now()/Intl çağırmadan (React Compiler purity kuralı, v6.183) ve
// effect içinde setState kurmadan (set-state-in-effect): useSyncExternalStore ile dış kaynak olarak okunur.
// Sunucu anlık görüntüsü null → SSR'da evre bilinmez, hidrasyonda dolar (randevu penceresi, H03).
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 60_000);
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}
// Dakikaya yuvarlanır → aynı dakika içinde kararlı değer (getSnapshot sözleşmesi).
const minuteSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const nullSnapshot = () => null;

/** Dakika hassasiyetinde "şimdi" (ms); sunucuda null. */
export function useNowMinute(): number | null {
  return useSyncExternalStore(subscribe, minuteSnapshot, nullSnapshot);
}

const noop = () => () => {};
const tzSnapshot = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Tarayıcının IANA saat dilimi; sunucuda null. */
export function useLocalTimeZone(): string | null {
  return useSyncExternalStore(noop, tzSnapshot, nullSnapshot);
}

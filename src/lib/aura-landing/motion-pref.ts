// Hero hareket tercihi (Paket 6, v6.299 — kontrol raporu: görünür "Hareketi durdur / oynat"). YALNIZ izleyici kolaylığı:
// localStorage `air_hero_motion` ("off" = otomatik oynatma kurulmaz; yoksa/başka = "on"); sunucuya/DB'ye gitmez, kimlikle ilişkilenmez.
// SSR/hidrasyon: sunucu anlık görüntüsü daima "on" (useSyncExternalStore) → hidrasyon uyumsuzluğu yok, istemci mount'ta gerçek değere döner.
// prefers-reduced-motion / Save-Data kuralı hero'da ayrıca uygulanır (bu modül yalnız tercihi taşır); açık istekle oynatma daima serbest.
import { useSyncExternalStore } from "react";

export const MOTION_KEY = "air_hero_motion";
export type MotionPref = "on" | "off";
type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "setItem" | "removeItem">;

const listeners = new Set<() => void>();

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // gizli pencere / engellenmiş site verisi
  }
}

/** Tercihi okur; depo yok/hatalı/boş → "on". */
export function readMotionPref(storage: ReadStore | null = safeStorage()): MotionPref {
  try {
    return storage?.getItem(MOTION_KEY) === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

/** Tercihi yazar ("on" = anahtar silinir) ve aynı sekmedeki aboneleri uyarır; depo hatası sessizce yutulur. */
export function writeMotionPref(value: MotionPref, storage: WriteStore | null = safeStorage()): void {
  try {
    if (value === "on") storage?.removeItem(MOTION_KEY);
    else storage?.setItem(MOTION_KEY, "off");
  } catch {
    /* depo yok — tercih yalnız bu render'da yaşar */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === MOTION_KEY) cb(); // başka sekme değiştirdi
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
const clientSnapshot = (): MotionPref => readMotionPref();
const serverSnapshot = (): MotionPref => "on";

/** Bileşen kancası: render'da localStorage okumadan, effect'te setState kurmadan (React Compiler kuralları) tercihi verir. */
export function useMotionPref(): MotionPref {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}

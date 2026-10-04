"use client";

import { useSyncExternalStore } from "react";

// Hukuki çeviri inceleme — paylaşılan istemci durumu (7-C editörü, 2026-10-03). Üst paneldeki eylemler (not · Onayla) ile çeviri
// panelindeki editör (düzenleme modu · birim düzenlemeleri) ayrı bileşenlerdir; aynı küçük dış mağazayı dinlerler. React Compiler
// kuralları gereği effect'te setState yerine useSyncExternalStore ([[react-now-usesyncexternalstore]] deseni). Sayfa (belge/dil)
// değişince editör mount'ta `key` ile sıfırlar; sunucu anlık görüntüsü sabit INITIAL (hidrasyon tutarlı). Yalnız istemci modülleri okur.
export type LegalReviewState = {
  key: string; // "<slug>/<code>" — hangi sayfanın düzenlemeleri
  editing: boolean; // düzenleme görünümü açık
  edits: Record<string, string>; // TR birim → düzenlenmiş çeviri (taslak; onayda gönderilir)
  note: string; // inceleme notu (üst panel)
};

const INITIAL: LegalReviewState = { key: "", editing: false, edits: {}, note: "" };
let state: LegalReviewState = INITIAL;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getLegalReviewState(): LegalReviewState {
  return state;
}
export function setLegalReviewState(patch: Partial<LegalReviewState>) {
  state = { ...state, ...patch };
  emit();
}
export function resetLegalReviewState(key: string) {
  state = { ...INITIAL, key };
  emit();
}
/** Bir birimin taslak çevirisi; null → düzenleme geri alınır (otomatik/dondurulmuş metne döner). */
export function setLegalEdit(unitKey: string, value: string | null) {
  const edits = { ...state.edits };
  if (value === null) delete edits[unitKey];
  else edits[unitKey] = value;
  state = { ...state, edits };
  emit();
}
export function useLegalReviewState(): LegalReviewState {
  return useSyncExternalStore(subscribe, getLegalReviewState, () => INITIAL);
}

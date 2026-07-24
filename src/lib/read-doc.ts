// Hasta belge-yükleme okuma yardımcıları — triyaj adım-2'den çıkarıldı (2026-07-24, DOCS_PENDING
// paketi): aynı mantığı hem triyaj formu hem vaka merkezindeki belge-tamamlama paneli kullanır.
// Tarayıcı File API'si kullanır → yalnız client bileşenlerinden import edilir ("use client" direktifi
// GEREKMEZ: veri değil saf fonksiyon export'u; server import etmedikçe RSC tuzağı yok).

// Triyajda yüklenen belge: ad + (AI'ye/sunucuya gönderilecek) base64 içerik.
// DICOM/büyük/desteklenmeyen → dataUrl null (yalnız ad).
export type UploadDoc = { name: string; mime: string; dataUrl: string | null };

export const DOC_MAX_BYTES = 8 * 1024 * 1024; // 8MB üstü içerik saklanmaz (yalnız ad) — base64 şişmesini sınırla
const IMG_MAX_DIM = 1600; // görüntüler bu kenar boyutuna küçültülür (AI okunabilirliği korunur)

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("okunamadı"));
    r.readAsDataURL(file);
  });
}

export function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, IMG_MAX_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const cx = canvas.getContext("2d");
        if (!cx) return reject(new Error("canvas yok"));
        cx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("görüntü yüklenemedi"));
      img.src = String(r.result);
    };
    r.onerror = () => reject(new Error("okunamadı"));
    r.readAsDataURL(file);
  });
}

// Görüntü → küçültülmüş JPEG; PDF (≤8MB) → base64; DICOM (≤8MB, v6.33) → base64 ASLIYLA saklanır
// (kullanıcı kararı: tıbbi kaydın aslı korunur; şifreleme sunucuda, AI değerlendirme DICOM'u atlar,
// doktor kokpit görüntüleyicisinde açılır); diğer/büyük → yalnız ad. AI yalnız içerikli PDF/görüntüyü işler.
export async function readDoc(file: File): Promise<UploadDoc> {
  const name = file.name;
  const type = file.type || "";
  try {
    if (type.startsWith("image/")) return { name, mime: "image/jpeg", dataUrl: await downscaleImage(file) };
    if (type === "application/pdf" && file.size <= DOC_MAX_BYTES) return { name, mime: "application/pdf", dataUrl: await fileToDataUrl(file) };
    const isDicom = type === "application/dicom" || /\.dcm$/i.test(name); // tarayıcı .dcm'de type'ı boş verir
    if (isDicom && file.size <= DOC_MAX_BYTES) {
      const raw = await fileToDataUrl(file);
      return { name, mime: "application/dicom", dataUrl: raw.replace(/^data:[^;]*;base64,/, "data:application/dicom;base64,") };
    }
  } catch {
    // okuma başarısız → yalnız ad
  }
  return { name, mime: type, dataUrl: null };
}

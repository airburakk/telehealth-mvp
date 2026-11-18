// Dosya gövdesini HTTP yanıtına akıtır — kart sürecini DÜŞÜRMEDEN (2026-11-18).
//
// NEDEN: `await pipeline(fs.createReadStream(yol), res)` istemci bağlantıyı yanıt "finish" olmadan kapatınca
// ERR_STREAM_PREMATURE_CLOSE ile REDDEDİLİR. Çağıranlar bunu yakalamıyordu → işlenmeyen reddetme (Node ≥15) bütün kart
// sürecini düşürüyordu. Bu bir yarış: Content-Length'in tamamını okuyup bağlantıyı hemen kapatan sıradan bir curl da
// tetikleyebiliyor (18.11 CI "kabul": iki ardışık koşuda `curl: (52) Empty reply from server`, konteyner günlüğünde
// "Premature close"). Üretimde aynı yol n8n'in MP4/PNG indirmelerinde sabah hattını düşürebilirdi.
//
// Kural: akış hatası yanıtı kapatır ve (erken kapanış dışında) günlüğe yazılır; ASLA fırlatmaz.
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

/**
 * @param {string} yol
 * @param {import("node:http").ServerResponse} res
 * @param {(mesaj: string) => void} [log]
 */
export async function dosyaAkit(yol, res, log = () => {}) {
  try {
    await pipeline(fs.createReadStream(yol), res);
  } catch (e) {
    // İstemcinin erken kapanışı olağan → sessiz. Okuma hatası vb. → günlüğe (yol yazılmaz; yalnız hata kodu).
    if (e?.code !== "ERR_STREAM_PREMATURE_CLOSE") log(`dosya akışı kesildi: ${e?.code ?? e?.message ?? e}`);
    if (!res.destroyed) res.destroy();
  }
}

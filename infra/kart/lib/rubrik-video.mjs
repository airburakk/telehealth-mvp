// Doctorium İÇERİK TAKVİMİ — rubrik YOUTUBE SHORT videosu + X ZİNCİR gruplaması (v6.340, 2026-10-08).
//
// 👤 Kararlar (07.10 → 08.10): rubrikler BEŞ mecraya gider (Instagram · LinkedIn · Facebook · X · YouTube); YouTube API'si görsel gönderi ALMAZ →
// rubrik YouTube'a ONAYLI slayt PNG'lerinden üretilen 9:16 dikey Short olarak gider. X tek gönderide en çok 4 görsel alır → ZİNCİR (ilk gönderi
// ilk 4 slayt, kalanı sırayla yanıt gönderilerinde, her biri ≤ 4).
//
// Değişmezler:
//   · Video = onaylı PNG'ler. Metin YENİDEN ÇİZİLMEZ (Chromium yok): her slayt olduğu gibi ortalanır, arka plan aynı slaytın bulanık büyütmesidir
//     → onay mührünün (`approvedHash`) kapsadığı içerik dışında hiçbir metin videoya girmez.
//   · Kare 0 DOLU: giriş kararması YOK (X/YouTube küçük resmi ilk saniyeden seçer; 07.10 Reel A posteri yarım kare dersi).
//   · Süre ≤ SHORT.enCokSn (Shorts sınırının güvenli altı): slayt sayısı artınca slayt süresi kısalır, asgari süreye inemezse HATA (kırpılmış video yok).
//   · Müzik isteğe bağlı: dosya yoksa video SESSİZ üretilir (Short yine geçerli); varsa tek geçiş loudnorm + kodlama SONRASI tepe koruması (aacGuvenli).
//   · Video hatası öğeyi DÜŞÜRMEZ: çağıran (rubrik-yayin) yalnız YouTube kanalını başarısız sayar; görseller diğer mecralara gider.
// 🪤 Kaynakta \uXXXX YAZMA. 🪤 Emoji YOK.
import fs from "node:fs";
import path from "node:path";
import { aacGuvenli, ff } from "./social-video.mjs";

export const SHORT = { w: 1080, h: 1920, slaytW: 1080, slaytH: 1350, fps: 30, slaytSn: 5, asgariSlaytSn: 3, gecisSn: 0.5, enCokSn: 58 };

/** X tek gönderide en çok bu kadar görsel alır. */
export const X_GORSEL_SINIRI = 4;

/** Slayt sırası (1 tabanlı) → X zincir grupları: [[1,2,3,4],[5,6,7,8],[9,10]]. 0 slayt → []. */
export function xGruplari(n, sinir = X_GORSEL_SINIRI) {
  if (!Number.isInteger(n) || n < 0) throw new Error("slayt sayısı geçersiz");
  const gruplar = [];
  for (let i = 1; i <= n; i += sinir) gruplar.push(Array.from({ length: Math.min(sinir, n - i + 1) }, (_, k) => i + k));
  return gruplar;
}

/**
 * n slaytın zamanlaması: her slayt `slaytSn` görünür, ardışık slaytlar `gecisSn` boyunca çapraz geçer.
 * Toplam = n·slaytSn − (n−1)·gecisSn. Sınırı aşarsa slayt süresi eşit kısalır; asgarinin altına inmesi gerekirse HATA.
 * @returns {{ slaytSn:number, gecisSn:number, toplamSn:number, ofsetler:number[] }} ofsetler[k] = (k+1). geçişin başladığı an
 */
export function shortZamanlama(n, o = SHORT) {
  if (!Number.isInteger(n) || n < 1) throw new Error("en az bir slayt gerekir");
  const gecis = n > 1 ? o.gecisSn : 0;
  let slayt = o.slaytSn;
  const toplam = (s) => n * s - (n - 1) * gecis;
  if (toplam(slayt) > o.enCokSn) slayt = Math.floor(((o.enCokSn + (n - 1) * gecis) / n) * 10) / 10;
  if (slayt < o.asgariSlaytSn) throw new Error(`${n} slayt ${o.enCokSn} sn içine sığmıyor (slayt başı ${slayt} sn < ${o.asgariSlaytSn} sn)`);
  const ofsetler = Array.from({ length: n - 1 }, (_, k) => Math.round((k + 1) * (slayt - gecis) * 1000) / 1000);
  return { slaytSn: slayt, gecisSn: gecis, toplamSn: Math.round(toplam(slayt) * 1000) / 1000, ofsetler };
}

/** ffmpeg filtre grafiği: her girdi → bulanık arka plan + ortalanmış slayt; ardından xfade zinciri → [v]. SAF (test edilir). */
export function shortFiltre(n, z, o = SHORT) {
  const parca = [];
  for (let i = 0; i < n; i++) {
    parca.push(
      `[${i}:v]scale=${o.slaytW}:${o.slaytH}:flags=lanczos,setsar=1,split[a${i}][b${i}]`,
      `[a${i}]scale=${o.w}:${o.h}:force_original_aspect_ratio=increase:flags=bicubic,crop=${o.w}:${o.h},boxblur=40:3,eq=brightness=-0.18[bg${i}]`,
      `[bg${i}][b${i}]overlay=(W-w)/2:(H-h)/2,format=yuv420p,fps=${o.fps},settb=AVTB[s${i}]`,
    );
  }
  if (n === 1) {
    parca.push(`[s0]null[v]`);
  } else {
    let onceki = "s0";
    for (let k = 1; k < n; k++) {
      const cikis = k === n - 1 ? "v" : `x${k}`;
      parca.push(`[${onceki}][s${k}]xfade=transition=fade:duration=${z.gecisSn}:offset=${z.ofsetler[k - 1]}[${cikis}]`);
      onceki = cikis;
    }
  }
  return parca.join(";");
}

/**
 * Onaylı slayt PNG'lerinden 1080×1920 Short MP4 üretir.
 * @param {{ pngYollari:string[], outPath:string, workDir:string, muzikPath?:string|null, ffImpl?:typeof ff, aacImpl?:typeof aacGuvenli }} a
 * @returns {Promise<{ sure_sn:number, sesli:boolean }>}
 */
export async function renderRubrikShort({ pngYollari, outPath, workDir, muzikPath = null, ffImpl = ff, aacImpl = aacGuvenli }) {
  const n = pngYollari.length;
  const z = shortZamanlama(n);
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const girdiler = pngYollari.flatMap((p) => ["-loop", 1, "-framerate", SHORT.fps, "-t", z.slaytSn, "-i", p]);
  const vOnly = path.join(workDir, "short-video.mp4");
  await ffImpl([
    ...girdiler,
    "-filter_complex", shortFiltre(n, z), "-map", "[v]",
    "-c:v", "libx264", "-preset", process.env.X264_PRESET || "medium", "-crf", 18, "-tune", "stillimage", "-profile:v", "high", "-level", "4.1",
    "-pix_fmt", "yuv420p", "-r", SHORT.fps, "-g", SHORT.fps * 2, "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-an", "-t", z.toplamSn, vOnly,
  ]);
  const sesli = Boolean(muzikPath) && fs.existsSync(muzikPath);
  if (!sesli) {
    await ffImpl(["-i", vOnly, "-c", "copy", "-movflags", "+faststart", outPath]);
    return { sure_sn: z.toplamSn, sesli: false };
  }
  const wav = path.join(workDir, "short-muzik.wav");
  const kapanis = Math.max(0, z.toplamSn - 1.5).toFixed(3);
  await ffImpl(["-t", z.toplamSn, "-i", muzikPath, "-af", `loudnorm=I=-16:TP=-2.5:LRA=7,afade=t=in:st=0:d=0.12,afade=t=out:st=${kapanis}:d=1.5`, "-ar", 48000, "-ac", 2, wav]);
  const m4a = path.join(workDir, "short-muzik.m4a");
  await aacImpl(wav, m4a, { tSec: z.toplamSn });
  await ffImpl(["-i", vOnly, "-i", m4a, "-c", "copy", "-t", z.toplamSn, "-movflags", "+faststart", outPath]);
  return { sure_sn: z.toplamSn, sesli: true };
}

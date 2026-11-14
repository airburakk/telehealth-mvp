import fs from "node:fs";
import { spawn } from "node:child_process";

/** Existing kart image installs ffmpeg/ffprobe together. No installation or
 * network calls; missing probe/invalid video blocks preparation.
 */
export function probeWeeklyVideo(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFPROBE || "ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { stdio: ["ignore", "pipe", "ignore"] });
    let bytes = "", settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(new Error("VIDEO_PROBE_FAILED")); else resolve(value); };
    const timer = setTimeout(() => { p.kill(); finish(true); }, 30000);
    p.stdout.on("data", b => { bytes += b.toString("utf8"); if (bytes.length > 262144) { p.kill(); finish(true); } });
    p.on("error", () => finish(true));
    p.on("close", code => { try { if (code !== 0) return finish(true); finish(false, JSON.parse(bytes)); } catch { finish(true); } });
  });
}

function fastStart(file) {
  const fd = fs.openSync(file, "r");
  try {
    const total = fs.fstatSync(fd).size, header = Buffer.alloc(16); let offset = 0, moov = -1, mdat = -1;
    for (let boxes = 0; offset < total && boxes < 64; boxes++) {
      if (total - offset < 8 || fs.readSync(fd, header, 0, Math.min(16, total - offset), offset) < 8) return false;
      const kind = header.toString("ascii", 4, 8); let size = header.readUInt32BE(0), minimum = 8;
      if (size === 1) { if (total - offset < 16) return false; size = Number(header.readBigUInt64BE(8)); minimum = 16; }
      if (size === 0) size = total - offset;
      if (!Number.isSafeInteger(size) || size < minimum || size > total - offset) return false;
      if (kind === "moov") moov = offset; if (kind === "mdat") mdat = offset;
      offset += size;
    }
    return offset === total && moov >= 0 && mdat > moov;
  } finally { fs.closeSync(fd); }
}

export async function validateWeeklyVideo(file, channel, { probe = probeWeeklyVideo } = {}) {
  if (!["facebook", "instagram", "linkedin", "x", "youtube"].includes(channel) || fs.statSync(file).size > 100 * 1024 * 1024 || !fastStart(file)) throw new Error("VIDEO_CONTAINER_REQUIRES_REVIEW");
  const metadata = await probe(file), streams = metadata?.streams;
  if (!Array.isArray(streams)) throw new Error("VIDEO_PROBE_FAILED");
  const video = streams.filter(s => s.codec_type === "video"), audio = streams.filter(s => s.codec_type === "audio"), v = video[0];
  const [width, height] = channel === "linkedin" ? [1920, 1080] : [1080, 1920];
  const duration = Number(metadata.format?.duration), rate = String(v?.avg_frame_rate).split("/").map(Number), fps = rate[0] / rate[1];
  if (video.length !== 1 || v.codec_name !== "h264" || v.width !== width || v.height !== height || v.pix_fmt !== "yuv420p" || !Number.isFinite(fps) || fps < 23 || fps > 60 || !Number.isFinite(duration) || duration < 3 || duration > 58.1 || audio.length > 1 || audio.some(a => a.codec_name !== "aac" || ![1, 2].includes(a.channels))) throw new Error("VIDEO_PROFILE_REQUIRES_REVIEW");
  return { width, height, duration, fps, audio: audio.length ? "aac" : "none", fastStart: true };
}

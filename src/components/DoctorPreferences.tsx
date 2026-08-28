"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { UserRound, ImagePlus, Clapperboard, PenLine, Link2, Save, Loader2, Check, HeartHandshake, Inbox, BadgeCheck, Luggage, X } from "lucide-react";
import { soEligible } from "@/lib/doctor-home";

// Doktorun profil tercihleri — 2026-08-14 (kullanıcı kararı) İÇERİK TAMAMEN DEĞİŞTİ:
// dil/pazar/kapasite alanları ÇIKTI (veri+API geriye-uyumla duruyor; düzenleme yüzeyi yok),
// yerine Profil Resmi + Video Kart + Hakkımda geldi; Birim katılımı anahtarları KORUNDU.
// Medya dosyaları @vercel/blob/client ile TARAYICIDAN DOĞRUDAN public Blob'a yüklenir
// (/api/doctor/media-upload token bekçisi; Vercel 4.5MB gövde limiti rota-üstü yüklemeyi keser).
// Yüklenen URL "Tercihleri kaydet" ile /api/doctor/preferences'a mühürlenir — kaydetmeden
// sayfadan çıkılırsa blob sahipsiz kalabilir (kabul edilen basitlik; değişimde eskisi silinir).
const PHOTO_MAX = 5 * 1024 * 1024; // 5MB
const VIDEO_MAX = 50 * 1024 * 1024; // 50MB — ≤60 sn beyanının fiziksel tavanı
const VIDEO_MAX_SEC = 60;

// Süre istemcide ölçülür (sunucuda ffmpeg yok). Metadata süresi okunamayan kayıtlar (ör. bazı
// canlı-kayıt webm'leri Infinity döner) REDDEDİLİR — 60 sn kuralı doğrulanamadan geçirilmez.
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("Video dosyası okunamadı.")); };
    v.src = URL.createObjectURL(file);
  });
}

function isPlayableUrl(u: string) {
  return u.includes(".blob.vercel-storage.com/") || /\.(mp4|webm|mov)(\?|$)/i.test(u);
}

export function DoctorPreferences({ bio, photo, introVideo, title, freeCareOptIn, consultOptIn, soOptIn, tourismOptIn }: {
  bio: string | null;
  photo: string | null;
  introVideo: string | null;
  /** İkinci Görüş ünvan kapısı için (soEligible) — panelVisibility ile AYNI kural, bkz. lib/doctor-home. */
  title: string | null;
  freeCareOptIn: boolean;
  consultOptIn: boolean;
  soOptIn: boolean;
  tourismOptIn: boolean;
}) {
  const router = useRouter();
  const [bioText, setBioText] = useState(bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(photo ?? "");
  const [videoUrl, setVideoUrl] = useState(introVideo ?? "");
  const [pb, setPb] = useState<boolean>(freeCareOptIn);
  const [cs, setCs] = useState<boolean>(consultOptIn);
  const [so, setSo] = useState<boolean>(soOptIn);
  const [tourism, setTourism] = useState<boolean>(tourismOptIn);
  const [phBusy, setPhBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);
  const [mediaErr, setMediaErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const soOpen = soEligible(title); // ünvan kapısı (Doç./Prof.) — onboarding kartıyla aynı kural

  const dirty =
    bioText.trim() !== (bio ?? "") ||
    photoUrl !== (photo ?? "") ||
    videoUrl.trim() !== (introVideo ?? "") ||
    pb !== freeCareOptIn ||
    cs !== consultOptIn ||
    so !== soOptIn ||
    tourism !== tourismOptIn;

  async function uploadFile(file: File, kind: "photo" | "video") {
    const ext = (file.name.split(".").pop() || (kind === "photo" ? "jpg" : "mp4")).toLowerCase().slice(0, 5);
    const blob = await upload(`profile-media/${kind}.${ext}`, file, {
      access: "public",
      handleUploadUrl: "/api/doctor/media-upload",
      clientPayload: kind,
    });
    return blob.url;
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setMediaErr(""); setSaved(false);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setMediaErr("Fotoğraf JPEG, PNG ya da WebP olmalı."); return; }
    if (file.size > PHOTO_MAX) { setMediaErr("Fotoğraf en fazla 5 MB olabilir."); return; }
    setPhBusy(true);
    try { setPhotoUrl(await uploadFile(file, "photo")); }
    catch (e) { setMediaErr(e instanceof Error ? e.message : "Fotoğraf yüklenemedi."); }
    finally { setPhBusy(false); }
  }

  async function onPickVideo(file: File | undefined) {
    if (!file) return;
    setMediaErr(""); setSaved(false);
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) { setMediaErr("Video MP4, WebM ya da MOV olmalı."); return; }
    if (file.size > VIDEO_MAX) { setMediaErr("Video en fazla 50 MB olabilir."); return; }
    setVidBusy(true);
    try {
      const dur = await videoDuration(file);
      if (!isFinite(dur)) throw new Error("Video süresi doğrulanamadı — lütfen MP4 olarak dışa aktarıp deneyin.");
      if (dur > VIDEO_MAX_SEC + 1) throw new Error(`Video en fazla ${VIDEO_MAX_SEC} saniye olabilir (seçilen: ${Math.round(dur)} sn).`);
      setVideoUrl(await uploadFile(file, "video"));
    } catch (e) { setMediaErr(e instanceof Error ? e.message : "Video yüklenemedi."); }
    finally { setVidBusy(false); }
  }

  async function save() {
    setSaving(true); setErr(""); setSaved(false);
    try {
      const r = await fetch("/api/doctor/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bioText.trim() || null,
          photo: photoUrl || null,
          introVideo: videoUrl.trim() || null,
          freeCareOptIn: pb,
          consultOptIn: cs,
          // Onboarding formuyla AYNI savunma: ünvansız doktor toggle'ı disabled görse de (kart
          // tıklanamaz) API'ye doğrudan true gönderilmez — kapı arayüzde tek savunma değildir.
          soOptIn: so && soOpen,
          tourismOptIn: tourism,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setSaved(true);
      router.refresh(); // hero/vitrin server-render foto ve bio'yu taze göstersin
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <h2 className="aura-display flex items-center gap-2 text-[17px] font-medium leading-tight tracking-tight text-[var(--c-ink)]">
        <UserRound size={17} className="text-[var(--c-accent)]" /> Profil Tercihleri
      </h2>

      {/* ── Profil Resmi ── */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]">
          <ImagePlus size={14} className="text-[var(--c-ink-3)]" /> Profil Resmi
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Profil resmi önizleme" className="h-20 w-20 rounded-3xl object-cover ring-1 ring-white/15" />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"><UserRound size={28} /></span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={phBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] disabled:opacity-50"
            >
              {phBusy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {photoUrl ? "Resmi değiştir" : "Resim seç"}
            </button>
            {photoUrl && (
              <button type="button" onClick={() => { setPhotoUrl(""); setSaved(false); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-[var(--c-ink-3)] hover:text-red-300">
                <X size={14} /> Kaldır
              </button>
            )}
            <span className="w-full text-[11px] text-[var(--c-ink-3)] sm:w-auto">JPEG/PNG/WebP · en fazla 5 MB</span>
          </div>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { onPickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>

      {/* ── Video Kart ── */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]">
          <Clapperboard size={14} className="text-[var(--c-ink-3)]" /> Video Kart
          <span className="text-xs font-normal text-[var(--c-ink-3)]">(tanıtım videosu — en fazla 60 saniye)</span>
        </div>
        {videoUrl && isPlayableUrl(videoUrl) && (
          <video src={videoUrl} controls preload="metadata" className="mt-2 w-full max-w-sm rounded-xl border border-[var(--c-hairline)]" />
        )}
        {videoUrl && !isPlayableUrl(videoUrl) && (
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-sm text-[var(--c-accent-stronger)] hover:underline">
            <Link2 size={14} className="shrink-0" /> <span className="truncate">{videoUrl}</span>
          </a>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => { setVideoUrl(e.target.value); setSaved(false); }}
            placeholder="https://youtube.com/... bağlantısı yapıştırın"
            className="w-full max-w-sm rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]"
          />
          <span className="text-xs text-[var(--c-ink-3)]">veya</span>
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={vidBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] disabled:opacity-50"
          >
            {vidBusy ? <Loader2 size={14} className="animate-spin" /> : <Clapperboard size={14} />} Dosya yükle
          </button>
          {videoUrl && (
            <button type="button" onClick={() => { setVideoUrl(""); setSaved(false); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-[var(--c-ink-3)] hover:text-red-300">
              <X size={14} /> Kaldır
            </button>
          )}
          <span className="w-full text-[11px] text-[var(--c-ink-3)]">MP4/WebM/MOV · en fazla 60 sn ve 50 MB</span>
          <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { onPickVideo(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>

      {/* ── Hakkımda ── */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]">
          <PenLine size={14} className="text-[var(--c-ink-3)]" /> Hakkımda Bölümü
        </div>
        <textarea
          value={bioText}
          onChange={(e) => { setBioText(e.target.value); setSaved(false); }}
          rows={5}
          maxLength={2000}
          placeholder="Kendinizi hastalarınıza tanıtın — uzmanlık alanlarınız, yaklaşımınız, deneyiminiz…"
          className="mt-2 w-full resize-y rounded-lg border border-[var(--c-hairline)] p-3 text-sm leading-relaxed outline-none focus:border-[var(--c-accent)]"
        />
        <div className="mt-1 text-end text-[11px] text-[var(--c-ink-3)]">{bioText.length}/2000</div>
      </div>

      {mediaErr && <p className="mt-3 text-sm text-red-300">{mediaErr}</p>}

      <div className="mt-5 border-t border-[var(--c-hairline)] pt-4">
        <div className="text-sm font-medium text-[var(--c-ink)]">Birim katılımı</div>
        <p className="text-xs text-[var(--c-ink-3)]">Ana Sayfanızdaki pencerelerin görünürlüğünü belirler.</p>
        <div className="mt-3 space-y-2">
          <OptToggle
            active={pb}
            onToggle={() => { setPb((v) => !v); setSaved(false); }}
            icon={<HeartHandshake size={16} />}
            title="Ücretsiz Sağlık Hizmeti — gönüllü konsültasyon"
            desc="Ana Sayfada Ücretsiz Sağlık Hizmeti penceresi görünür; gönüllü ücretsiz görüşme alırsınız."
          />
          <OptToggle
            active={cs}
            onToggle={() => { setCs((v) => !v); setSaved(false); }}
            icon={<Inbox size={16} />}
            title="Konsültasyon Talepleri — Partner doktorlar"
            desc="Anonim hasta dosyalarına görüş verirsiniz; yanıt başına ödeme (simüle)."
          />
          {/* İkinci Görüş — ünvan kapısı VE tercih (v6.105). Ünvan uygun değilse kart "ölü"
              (tıklanamaz) — onboarding kartıyla birebir aynı desen/metin. */}
          <OptToggle
            active={so && soOpen}
            onToggle={() => { setSo((v) => !v); setSaved(false); }}
            disabled={!soOpen}
            icon={<BadgeCheck size={16} />}
            title="İkinci Görüş Paneli"
            desc={soOpen
              ? "Tanı konmuş hastaların belgelerini inceleyip yazılı görüş ve video görüşme sunarsınız."
              : "Yalnız Doçent / Profesör ünvanlı doktorlara açılır — ünvanınız uygun olmadığı için seçime kapalıdır."}
          />
          {/* Sağlık Turizmi — ünvan şartı YOK, tüm doktorlara açık (v6.105). ⚠️ Turizm kulvarı
              ÖDEMESİZ (escrow/split yok) — ücret dili KULLANILMAZ, onboarding kartıyla tutarlı. */}
          <OptToggle
            active={tourism}
            onToggle={() => { setTourism((v) => !v); setSaved(false); }}
            icon={<Luggage size={16} />}
            title="Sağlık Turizmi Paneli"
            desc="Yurt dışından gelen hastaların branşınıza düşen tedavi taleplerini karşılarsınız."
          />
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <button
        onClick={save}
        disabled={saving || phBusy || vidBusy || !dirty}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? "Kaydedildi" : "Tercihleri kaydet"}
      </button>
    </div>
  );
}

function OptToggle({ active, onToggle, disabled, icon, title, desc }: { active: boolean; onToggle: () => void; disabled?: boolean; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${disabled ? "cursor-not-allowed border-[var(--c-hairline)] bg-[var(--c-panel)] opacity-60" : active ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40"}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${active ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--c-ink)]">{title}</span>
        <span className="block text-xs text-[var(--c-ink-2)]">{desc}</span>
      </span>
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-transparent"}`}>
        <Check size={12} />
      </span>
    </button>
  );
}

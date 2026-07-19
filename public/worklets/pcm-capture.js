// PCM yakalama worklet'i (v6.29.2) — ScriptProcessorNode'un düşük-gecikmeli, AYRI iş-parçacığı karşılığı.
// KENDİ mikrofon sesinin render-quantum'larını (128 örnek) 16 kHz Int16 PCM'e indirir ve ~20 ms'lik
// gruplar halinde ana iş parçacığına TRANSFER eder (kopyasız). Böylece eski 4096-örnek (~256 ms) blok
// tamponu ~20 ms'ye iner + UI (React) iş parçacığı jitter'ı ortadan kalkar.
//
// PHI: yalnız ham ses baytları taşınır (zaten görüşmenin canlı sesi); metin/transkript/log YOK.
// Düz tarayıcı JS'idir (public/ altından HAM servis edilir; import/TS yok — addModule ile yüklenir).
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / 16000;   // AudioContext 16 kHz'i onurlandırmazsa aşağı indir
    this._buf = new Int16Array(2048);    // biriken 16 kHz Int16 örnekler
    this._n = 0;
    this._target = 320;                  // ~20 ms @ 16 kHz — gönderim grubu boyu
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;                // giriş yok → node'u canlı tut
    const ratio = this._ratio;
    const outLen = ratio <= 1 ? ch.length : Math.max(1, Math.floor(ch.length / ratio));
    for (let i = 0; i < outLen; i++) {
      let s = ch[ratio <= 1 ? i : Math.min(ch.length - 1, Math.floor(i * ratio))];
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      if (this._n >= this._buf.length) {
        const bigger = new Int16Array(this._buf.length * 2);
        bigger.set(this._buf);
        this._buf = bigger;
      }
      this._buf[this._n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    while (this._n >= this._target) {
      const out = this._buf.slice(0, this._target);      // kendi buffer'ı → transfer edilebilir
      this._buf.copyWithin(0, this._target, this._n);
      this._n -= this._target;
      this.port.postMessage(out.buffer, [out.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCaptureProcessor);

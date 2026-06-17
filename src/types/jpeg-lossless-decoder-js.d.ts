// jpeg-lossless-decoder-js paketi tip tanımı içermiyor — DicomViewer'daki dinamik
// import için minimal ambient declaration. Decode JPEG Lossless (.57/.70) bitstream.
declare module "jpeg-lossless-decoder-js" {
  /** JPEG Lossless (ISO 10918-1, Process 14 SV1) çözücü. */
  export class Decoder {
    constructor(buffer?: ArrayBuffer, numBytes?: number);
    /**
     * Sıkıştırılmış JPEG-lossless bitstream'i çözer.
     * @param buffer  bitstream'i içeren ArrayBuffer
     * @param offset  başlangıç byte ofseti
     * @param length  bitstream uzunluğu (byte)
     * @param numBytes örnek başına byte (1 → Uint8Array, 2 → Uint16Array; işaretsiz)
     */
    decode(buffer: ArrayBuffer, offset: number, length: number, numBytes?: number): Uint8Array | Uint16Array;
  }
}

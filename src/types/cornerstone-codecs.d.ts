// @cornerstonejs/codec-openjpeg ve codec-charls WASM glue subpath'leri tip içermiyor —
// DicomViewer'daki dinamik import için minimal ambient declaration. Factory'yi locateFile
// ile çağırınca decoder sınıflarını (J2KDecoder / JpegLSDecoder) içeren modülü döndürür.
declare module "@cornerstonejs/codec-openjpeg/wasmjs" {
  const factory: unknown;
  export default factory;
}
declare module "@cornerstonejs/codec-charls/wasmjs" {
  const factory: unknown;
  export default factory;
}

// Tarayıcı derlemesinde node-builtin'leri (fs/path/crypto) stub'lamak için boş modül.
// DICOM WASM codec glue'su (Emscripten) bunları yalnız ENVIRONMENT_IS_NODE dalında require
// eder; tarayıcıda asla çağrılmaz, bu yüzden boş nesne yeterli. Bkz. next.config.ts turbopack.
module.exports = {};

# -*- coding: utf-8 -*-
"""
SIKIŞTIRILMIŞ sentetik DICOM test dosyaları üretir → public/dicom/test-*.dcm
DicomViewer'ın sıkıştırılmış codec desteğini tarayıcıda doğrulamak içindir.
Gerçek hasta verisi DEĞİLDİR.

Üretilenler:
  test-rle.dcm            : RLE Lossless,        16-bit MONOCHROME2, 8 kare (BT benzeri)
  test-jpeg-lossless.dcm  : JPEG Lossless SV1,   16-bit MONOCHROME2, 6 kare (BT benzeri)
  test-jpeg-baseline.dcm  : JPEG Baseline 8-bit, 8-bit  MONOCHROME2, 4 kare (US benzeri)
  test-jpeg2000.dcm       : JPEG 2000 Lossless,  16-bit MONOCHROME2, 6 kare (BT benzeri)  [WASM: OpenJPEG]
  test-jpegls.dcm         : JPEG-LS Lossless,    16-bit MONOCHROME2, 6 kare (BT benzeri)  [WASM: CharLS]

RLE: pydicom native encoder. JPEG/J2K/JPEG-LS: imagecodecs ile encode + manuel encapsulate.
Kayıpsız formatlarda kare kare round-trip eşitlik kontrolü yapılır.
Gerekli: pip install pydicom numpy imagecodecs
Kullanım: python scripts/make-compressed-dicoms.py
"""
import os
import numpy as np
import imagecodecs
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.encaps import encapsulate
from pydicom.uid import (
    ExplicitVRLittleEndian, RLELossless, JPEGBaseline8Bit, JPEGLosslessSV1,
    JPEG2000Lossless, JPEGLSLossless, generate_uid, CTImageStorage,
)

H = W = 256
US_SOP = "1.2.840.10008.5.1.4.1.1.6.1"  # Ultrasound Image Storage


def grid():
    ys = np.repeat(np.linspace(-1, 1, H)[:, None], W, axis=1)
    xs = np.repeat(np.linspace(-1, 1, W)[None, :], H, axis=0)
    return ys, xs


def ellipse(yy, xx, cy, cx, ay, ax):
    return ((yy - cy) / ay) ** 2 + ((xx - cx) / ax) ** 2 <= 1.0


def ct_like(i, n):
    """16-bit BT benzeri kesit (gövde + vertebra + akciğer + orta kesitte nodül)."""
    yy, xx = grid()
    rng = np.random.default_rng(500 + i)
    img = np.zeros((H, W), np.float32)
    body = ellipse(yy, xx, 0.05, 0, 0.74, 0.95)
    img[body] = 900 + rng.normal(0, 12, (H, W))[body]
    img[ellipse(yy, xx, 0.58, 0, 0.16, 0.13)] = 1850            # vertebra
    lungL = ellipse(yy, xx, -0.02, -0.44, 0.54, 0.30) & body
    lungR = ellipse(yy, xx, -0.02, 0.44, 0.54, 0.30) & body
    img[lungL | lungR] = 70 + rng.normal(0, 10, (H, W))[lungL | lungR]
    t = i / max(1, n - 1)
    r = 0.085 * max(0.0, 1 - abs(t - 0.5) * 2.6)
    if r > 0.012:
        img[ellipse(yy, xx, -0.06, 0.46, r, r) & body] = 1280   # nodül
    return np.clip(img, 0, 2000).astype(np.uint16)


def us_like(i, n):
    """8-bit US benzeri sektör (benek + foliküller)."""
    yy, xx = grid()
    rng = np.random.default_rng(600 + i)
    dy = yy - (-1.05); dx = xx - 0.0
    rad = np.sqrt(dx * dx + dy * dy); ang = np.arctan2(dx, dy)
    sector = (np.abs(ang) < 0.52) & (rad > 0.18) & (rad < 1.98)
    img = np.zeros((H, W), np.float32)
    img[sector] = rng.normal(150, 38, (H, W))[sector]
    img *= np.where(sector, np.clip(1 - 0.30 * rad, 0.3, 1), 1)
    for cy0, cx0, fr in [(0.30, -0.22, 0.13), (0.55, 0.10, 0.10), (0.45, 0.30, 0.07 + 0.02 * (i % 3))]:
        img[ellipse(yy, xx, cy0, cx0, fr, fr) & sector] = 12
    img[~sector] = 0
    return np.clip(img, 0, 255).astype(np.uint8)


def make_dataset(modality, sop, name, pid, desc, bits, wc, ww, n, ts_name):
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = sop
    meta.MediaStorageSOPInstanceUID = generate_uid()
    meta.ImplementationClassUID = generate_uid()
    ds = Dataset()
    ds.file_meta = meta
    ds.SOPClassUID = sop
    ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.PatientName = name
    ds.PatientID = pid
    ds.Modality = modality
    ds.StudyDescription = desc
    ds.SeriesDescription = ts_name
    ds.Rows, ds.Columns = H, W
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = bits
    ds.BitsStored = bits
    ds.HighBit = bits - 1
    ds.PixelRepresentation = 0
    ds.NumberOfFrames = n
    ds.WindowCenter = wc
    ds.WindowWidth = ww
    ds.RescaleIntercept = 0
    ds.RescaleSlope = 1
    return ds


def save(ds, path, ts_name):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ds.save_as(path, enforce_file_format=True)
    kb = os.path.getsize(path) // 1024
    print(f"yazildi: {os.path.relpath(path)} ({kb} KB, {int(ds.NumberOfFrames)}x{H}x{W}, {ts_name})")


def build_rle(path, frames_fn, n, **kw):
    """RLE: pydicom native encoder ile compress."""
    vol = np.stack([frames_fn(i, n) for i in range(n)], 0)
    ds = make_dataset(bits=16, n=n, ts_name="RLE Lossless", **kw)
    ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds.PixelData = vol.astype("<u2").tobytes()
    ds.compress(RLELossless)
    save(ds, path, "RLE Lossless")


def build_enc(path, frames_fn, n, *, encode, ts, ts_name, bits, decode=None, **kw):
    """imagecodecs ile kare kare encode + manuel encapsulate. decode verilirse round-trip eşitlik kontrolü."""
    frames = []
    for i in range(n):
        arr = frames_fn(i, n)
        enc = encode(arr)
        if decode is not None:
            back = np.asarray(decode(enc)).reshape(arr.shape)
            assert np.array_equal(back, arr), f"{ts_name} round-trip kare {i} eşit değil!"
        frames.append(bytes(enc))
    ds = make_dataset(bits=bits, n=n, ts_name=ts_name, **kw)
    ds.file_meta.TransferSyntaxUID = ts
    ds.PixelData = encapsulate(frames)
    ds["PixelData"].is_undefined_length = True
    save(ds, path, ts_name)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "public", "dicom")

    build_rle(os.path.join(out, "test-rle.dcm"), ct_like, 8,
              modality="CT", sop=CTImageStorage, name="TEST^RLE", pid="TEST-RLE-01",
              desc="Sikistirilmis Test BT (RLE)", wc=900, ww=1600)

    build_enc(os.path.join(out, "test-jpeg-lossless.dcm"), ct_like, 6,
              encode=imagecodecs.ljpeg_encode, decode=imagecodecs.ljpeg_decode,
              ts=JPEGLosslessSV1, ts_name="JPEG Lossless SV1", bits=16,
              modality="CT", sop=CTImageStorage, name="TEST^JPEGLossless", pid="TEST-JPLL-01",
              desc="Sikistirilmis Test BT (JPEG Lossless)", wc=900, ww=1600)

    build_enc(os.path.join(out, "test-jpeg-baseline.dcm"), us_like, 4,
              encode=lambda a: imagecodecs.jpeg8_encode(a, level=92),
              ts=JPEGBaseline8Bit, ts_name="JPEG Baseline 8-bit", bits=8,
              modality="US", sop=US_SOP, name="TEST^JPEGBaseline", pid="TEST-JPBL-01",
              desc="Sikistirilmis Test US (JPEG Baseline)", wc=128, ww=255)

    build_enc(os.path.join(out, "test-jpeg2000.dcm"), ct_like, 6,
              encode=lambda a: imagecodecs.jpeg2k_encode(a, reversible=True, codecformat="J2K"),
              decode=imagecodecs.jpeg2k_decode,
              ts=JPEG2000Lossless, ts_name="JPEG 2000 Lossless", bits=16,
              modality="CT", sop=CTImageStorage, name="TEST^JPEG2000", pid="TEST-J2K-01",
              desc="Sikistirilmis Test BT (JPEG 2000)", wc=900, ww=1600)

    build_enc(os.path.join(out, "test-jpegls.dcm"), ct_like, 6,
              encode=lambda a: imagecodecs.jpegls_encode(a, level=0),
              decode=imagecodecs.jpegls_decode,
              ts=JPEGLSLossless, ts_name="JPEG-LS Lossless", bits=16,
              modality="CT", sop=CTImageStorage, name="TEST^JPEGLS", pid="TEST-JPLS-01",
              desc="Sikistirilmis Test BT (JPEG-LS)", wc=900, ww=1600)


if __name__ == "__main__":
    main()

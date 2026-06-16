# -*- coding: utf-8 -*-
"""
Demo amaçlı SENTETİK çok-kareli DICOM çalışmaları üretir → public/dicom/*.dcm
Belirli hastalara (doktor kokpitinde görüntülenmek üzere) branşa uygun çalışmalar:
  - toraks-bt.dcm : Toraks BT (akciğer nodülü) — Onkoloji/Kardiyoloji/Göğüs
  - diz-mr.dcm    : Diz MR — Ortopedi
Gerçek hasta verisi DEĞİLDİR; M2 DICOM görüntüleyiciyi (sıkıştırmasız, 16-bit MONOCHROME2)
gerçekçi içerikle test/demoda kullanmak içindir. Kullanım: python scripts/make-demo-dicoms.py
Gerekli: pip install pydicom numpy
"""
import os
import numpy as np
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid, CTImageStorage, MRImageStorage

H = W = 256

def ellipse(yy, xx, cy, cx, ay, ax):
    return ((yy - cy) / ay) ** 2 + ((xx - cx) / ax) ** 2 <= 1.0

def grid():
    ys = np.repeat(np.linspace(-1, 1, H)[:, None], W, axis=1)
    xs = np.repeat(np.linspace(-1, 1, W)[None, :], H, axis=0)
    return ys, xs

def chest_ct(i, n):
    yy, xx = grid()
    rng = np.random.default_rng(i)
    img = np.zeros((H, W), np.float32)
    body = ellipse(yy, xx, 0.05, 0, 0.74, 0.95)
    img[body] = 900 + rng.normal(0, 12, (H, W))[body]            # yumuşak doku
    spine = ellipse(yy, xx, 0.58, 0, 0.16, 0.13)
    img[spine] = 1850                                            # vertebra (kemik)
    heart = ellipse(yy, xx, 0.12, -0.14, 0.34, 0.30) & body
    img[heart] = 1010                                           # kalp/mediasten
    lungL = ellipse(yy, xx, -0.02, -0.44, 0.54, 0.30) & body
    lungR = ellipse(yy, xx, -0.02, 0.44, 0.54, 0.30) & body
    lungs = (lungL | lungR) & ~heart & ~spine
    img[lungs] = 70 + rng.normal(0, 10, (H, W))[lungs]          # akciğer (hava, koyu)
    # damar izleri (akciğerde ince parlak noktalar)
    for _ in range(60):
        yk = rng.integers(0, H); xk = rng.integers(0, W)
        if lungs[yk, xk]:
            img[max(0, yk-1):yk+1, max(0, xk-1):xk+1] = 700
    # spiküle nodül — sağ akciğerde, orta kesitlerde belirginleşir (klinik bulgu)
    t = i / (n - 1)
    r = 0.085 * max(0.0, 1 - abs(t - 0.5) * 2.6)
    if r > 0.012:
        nod = ellipse(yy, xx, -0.06, 0.46, r, r) & body
        img[nod] = 1280
    return np.clip(img, 0, 2000).astype(np.uint16)

def knee_mr(i, n):
    yy, xx = grid()
    rng = np.random.default_rng(100 + i)
    img = np.zeros((H, W), np.float32)
    soft = ellipse(yy, xx, 0, 0, 0.92, 0.60)
    img[soft] = 560 + rng.normal(0, 14, (H, W))[soft]          # yumuşak doku
    femur = ellipse(yy, xx, -0.46, 0.0, 0.34, 0.36)            # femur (üst)
    tibia = ellipse(yy, xx, 0.52, 0.0, 0.36, 0.32)             # tibia (alt)
    img[femur] = 300                                           # kortikal kemik (koyu)
    img[tibia] = 300
    img[ellipse(yy, xx, -0.46, 0.0, 0.26, 0.28)] = 1150        # iliğin parlağı
    img[ellipse(yy, xx, 0.52, 0.0, 0.28, 0.24)] = 1150
    patella = ellipse(yy, xx, -0.05, -0.5, 0.16, 0.10) & soft
    img[patella] = 380
    # eklem aralığı / efüzyon — orta kesitlerde parlak (sıvı)
    t = i / (n - 1)
    if abs(t - 0.5) < 0.28:
        eff = ellipse(yy, xx, 0.03, 0.0, 0.07, 0.30) & soft
        img[eff] = 1300
    return np.clip(img, 0, 1600).astype(np.uint16)

def build(path, frames_fn, n, modality, sop, name, pid, desc, wc, ww):
    vol = np.stack([frames_fn(i, n) for i in range(n)], 0)
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = sop
    meta.MediaStorageSOPInstanceUID = generate_uid()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
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
    ds.SeriesDescription = f"{desc} · {n} kesit (sentetik demo)"
    ds.Rows, ds.Columns = H, W
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.NumberOfFrames = n
    ds.WindowCenter = wc
    ds.WindowWidth = ww
    ds.RescaleIntercept = 0
    ds.RescaleSlope = 1
    ds.PixelData = vol.astype("<u2").tobytes()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ds.save_as(path, enforce_file_format=True)
    print(f"yazildi: {os.path.relpath(path)} ({os.path.getsize(path)//1024} KB, {n}x{H}x{W})")

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "public", "dicom")
    build(os.path.join(out, "toraks-bt.dcm"), chest_ct, 24, "CT", CTImageStorage,
          "DEMO^Toraks", "DEMO-CT-01", "Toraks BT", 900, 1600)
    build(os.path.join(out, "diz-mr.dcm"), knee_mr, 20, "MR", MRImageStorage,
          "DEMO^Diz", "DEMO-MR-01", "Diz MR", 650, 1300)

if __name__ == "__main__":
    main()

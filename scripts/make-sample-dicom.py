# -*- coding: utf-8 -*-
"""
Demo amaçlı SENTETİK çok kareli (multi-frame) DICOM üretir → public/sample-dicom.dcm
Beyin-BT benzeri bir fantom (kafatası halkası + beyin + ventriküller + büyüyen nodül),
256x256, 16 kare, 16-bit MONOCHROME2, sıkıştırmasız (Explicit VR Little Endian).

Gerçek hasta verisi DEĞİLDİR; M2 DICOM görüntüleyiciyi depolama (S3) olmadan
demoda/lokalde test edebilmek içindir. Kullanım:  python scripts/make-sample-dicom.py
Gerekli: pip install pydicom numpy
"""
import os
import numpy as np
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid, CTImageStorage

H = W = 256
N = 16  # kare (dilim) sayısı

def ellipse(yy, xx, cy, cx, ay, ax):
    return ((yy - cy) / ay) ** 2 + ((xx - cx) / ax) ** 2 <= 1.0

def frame(i):
    ys = np.linspace(-1, 1, H)[:, None]
    xs = np.linspace(-1, 1, W)[None, :]
    yy = np.repeat(ys, W, axis=1)
    xx = np.repeat(xs, H, axis=0)
    img = np.zeros((H, W), dtype=np.float32)
    skull_out = ellipse(yy, xx, 0, 0, 0.92, 0.86)
    skull_in = ellipse(yy, xx, 0, 0, 0.84, 0.78)
    img[skull_out] = 1300.0                 # kafatası (parlak halka)
    img[skull_in] = 520.0                   # beyin dokusu
    # ventriküller (koyu) — hafifçe dilime göre kayar
    shift = (i - N / 2) * 0.01
    img[ellipse(yy, xx, 0.02, -0.16 + shift, 0.20, 0.09)] = 120.0
    img[ellipse(yy, xx, 0.02, 0.16 + shift, 0.20, 0.09)] = 120.0
    # büyüyen nodül (parlak) — dilim ilerledikçe büyür, klinik görünüm
    r = 0.03 + 0.06 * (i / (N - 1))
    img[ellipse(yy, xx, -0.30, 0.28, r, r)] = 1180.0
    # hafif gürültü (gerçekçilik)
    img[skull_in] += np.random.default_rng(i).normal(0, 14, img.shape)[skull_in]
    return np.clip(img, 0, 1500).astype(np.uint16)

def main():
    vol = np.stack([frame(i) for i in range(N)], axis=0)  # (N,H,W)

    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = CTImageStorage
    meta.MediaStorageSOPInstanceUID = generate_uid()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    meta.ImplementationClassUID = generate_uid()

    ds = Dataset()
    ds.file_meta = meta
    ds.SOPClassUID = CTImageStorage
    ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.PatientName = "DEMO^Radyoloji"
    ds.PatientID = "DEMO-0001"
    ds.Modality = "CT"
    ds.StudyDescription = "Beyin BT (sentetik demo)"
    ds.SeriesDescription = "Aksiyel · 16 kesit"
    ds.Rows, ds.Columns = H, W
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.NumberOfFrames = N
    ds.WindowCenter = 600
    ds.WindowWidth = 1200
    ds.RescaleIntercept = 0
    ds.RescaleSlope = 1
    ds.PixelData = vol.astype("<u2").tobytes()

    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "public", "sample-dicom.dcm")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    ds.save_as(dest, enforce_file_format=True)
    print(f"yazildi: {os.path.relpath(dest)}  ({os.path.getsize(dest)//1024} KB, {N} kare {H}x{W})")

if __name__ == "__main__":
    main()

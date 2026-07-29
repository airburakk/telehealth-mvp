# -*- coding: utf-8 -*-
"""
Burned-in (piksele işlenmiş) PHI test dosyaları üretir → public/dicom/test-burnin-*.dcm
v6.37 piksel maskeleme motorunun (lib/dicom-pixels + lib/dicom-burnin) regresyon nöbeti.

Üretilenler:
  test-burnin-us-regions.dcm : US + SequenceOfUltrasoundRegions → otomatik kural yazıyı KAPATMALI
  test-burnin-us-plain.dcm   : US, sekans YOK → üst şerit kuralı yazıyı KAPATMALI
  test-burnin-ct-corner.dcm  : CT, SAĞ ALT köşede yazı → otomatik kural YAKALAMAZ (elle kutu şart)

Yazı pikselleri kasten MAKSİMUM değerde basılır; testler "maskeden sonra o bölgede parlak piksel
kalmadı" diye ölçer. Gerçek hasta verisi DEĞİLDİR — uydurma ad/tarih/numara.
Kullanım: python scripts/make-burnin-dicoms.py   (gerekli: pydicom numpy pillow)
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid, CTImageStorage

H = W = 256
US_SOP = "1.2.840.10008.5.1.4.1.1.6.1"
MAXV = 4000  # yazı parlaklığı (test eşiği bunun altında kalan her şeyi "anatomi" sayar)
BAND = 26    # US üst bilgi şeridi yüksekliği (px)


def text_mask(lines, xy, size=11):
    """Verilen satırları 1-bit maskeye çizer (PIL varsayılan bitmap fontu — sistemden bağımsız)."""
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    x, y = xy
    for i, line in enumerate(lines):
        d.text((x, y + i * (size + 1)), line, fill=255)
    return np.array(img) > 0


def us_frame(i):
    """Sektör (yelpaze) ultrason görüntüsü — üst şerit siyah bırakılır (cihaz arayüzü)."""
    ys = np.repeat(np.linspace(-1, 1, H)[:, None], W, axis=1)
    xs = np.repeat(np.linspace(-1, 1, W)[None, :], H, axis=0)
    rng = np.random.default_rng(500 + i)
    dy = ys - (-1.05)
    rad = np.sqrt(xs * xs + dy * dy)
    ang = np.arctan2(xs, dy)
    sector = (np.abs(ang) < 0.52) & (rad > 0.18) & (rad < 1.98)
    sector[:BAND, :] = False  # arayüz şeridi görüntü alanı DIŞI
    img = np.zeros((H, W), np.float32)
    img[sector] = rng.normal(430, 95, (H, W))[sector]
    img *= np.where(sector, np.clip(1 - 0.30 * rad, 0.3, 1), 1)
    for cy, cx, fr in [(0.30, -0.22, 0.13), (0.55, 0.10, 0.10)]:
        cyst = ((ys - cy) / fr) ** 2 + ((xs - cx) / fr) ** 2 <= 1.0
        img[cyst & sector] = 35
    return np.clip(img, 0, 1000).astype(np.float32)


def ct_frame(i):
    ys = np.repeat(np.linspace(-1, 1, H)[:, None], W, axis=1)
    xs = np.repeat(np.linspace(-1, 1, W)[None, :], H, axis=0)
    rng = np.random.default_rng(600 + i)
    img = np.zeros((H, W), np.float32)
    body = (ys / 0.74) ** 2 + (xs / 0.95) ** 2 <= 1.0
    img[body] = 900 + rng.normal(0, 12, (H, W))[body]
    spine = ((ys - 0.58) / 0.16) ** 2 + (xs / 0.13) ** 2 <= 1.0
    img[spine] = 1850
    return np.clip(img, 0, 2000).astype(np.float32)


def build(path, frames, modality, sop, regions, desc):
    vol = np.stack(frames, 0).astype("<u2")
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
    ds.PatientName = "TEST^BurnedIn"
    ds.PatientID = "TEST-BURNIN-01"
    ds.Modality = modality
    ds.StudyDescription = desc
    ds.SeriesDescription = desc
    ds.BurnedInAnnotation = "YES"          # (0028,0301) — dosya kendini işaretliyor
    ds.Rows, ds.Columns = H, W
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.NumberOfFrames = len(frames)
    ds.WindowCenter = 500
    ds.WindowWidth = 1000
    ds.RescaleIntercept = 0
    ds.RescaleSlope = 1
    if regions:
        # (0018,6011) SequenceOfUltrasoundRegions — cihazın "gerçek görüntü alanı" beyanı.
        reg = Dataset()
        reg.RegionSpatialFormat = 1
        reg.RegionDataType = 1
        reg.RegionFlags = 0
        reg.RegionLocationMinX0 = 0
        reg.RegionLocationMinY0 = BAND
        reg.RegionLocationMaxX1 = W
        reg.RegionLocationMaxY1 = H
        reg.PhysicalUnitsXDirection = 3
        reg.PhysicalUnitsYDirection = 3
        reg.PhysicalDeltaX = 0.01
        reg.PhysicalDeltaY = 0.01
        ds.SequenceOfUltrasoundRegions = [reg]
    ds.PixelData = vol.tobytes()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ds.save_as(path, enforce_file_format=True)
    print(f"yazildi: {os.path.relpath(path)} ({os.path.getsize(path)//1024} KB, {len(frames)}x{H}x{W})")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "public", "dicom")

    # US: üst şeride hasta kimliği basılı (iki varyant — sekanslı / sekanssız)
    top = text_mask(["AYSE YILMAZ  12.03.1978", "MRN 4471902  DR. KAYA"], (4, 3))
    us = []
    for i in range(4):
        f = us_frame(i)
        f[top] = MAXV
        us.append(f)
    build(os.path.join(out, "test-burnin-us-regions.dcm"), us, "US", US_SOP, True, "US burned-in (regions)")
    build(os.path.join(out, "test-burnin-us-plain.dcm"), us, "US", US_SOP, False, "US burned-in (regionsuz)")

    # CT: SAĞ ALT köşede kimlik → hiçbir otomatik kural yakalamaz, elle kutu gerekir
    corner = text_mask(["MRN 4471902", "AYSE YILMAZ"], (150, 232))
    ct = []
    for i in range(3):
        f = ct_frame(i)
        f[corner] = MAXV
        ct.append(f)
    build(os.path.join(out, "test-burnin-ct-corner.dcm"), ct, "CT", CTImageStorage, False, "CT burned-in (kose)")


if __name__ == "__main__":
    main()

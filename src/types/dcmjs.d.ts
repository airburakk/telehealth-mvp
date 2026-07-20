// dcmjs resmi tip yayınlamıyor — kullandığımız dar yüzeyin bildirimi (dicom-deidentify.ts).
declare module "dcmjs" {
  export interface DcmElement {
    vr: string;
    Value?: unknown[];
  }
  export interface DcmDataset {
    meta: Record<string, DcmElement>;
    dict: Record<string, DcmElement>;
    write(): ArrayBuffer;
  }
  const dcmjs: {
    data: {
      DicomMessage: { readFile(buffer: ArrayBuffer, options?: unknown): DcmDataset };
      DicomMetaDictionary: { uid(): string };
    };
  };
  export default dcmjs;
}

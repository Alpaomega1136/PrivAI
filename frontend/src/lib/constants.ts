// Shared constants for Spectre frontend.

export const PRIVACY_CLASSES = ["KTP", "SIM", "Paspor", "NIK_Teks", "Wajah", "Plat_Nomor"];

export const PERFORMANCE_MODES = [
  {
    value: "fast",
    label: "Fast Demo",
    description: "Recommended untuk live hackathon demo. 1x inference, tanpa OCR, tanpa heavy TTA.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Recommended untuk verifikasi normal. TTA 0 dan 180, OCR mati default.",
  },
  {
    value: "robust",
    label: "Robust Verification",
    description: "Untuk dokumen sulit. Lebih banyak rotasi, guardrail OCR-capable, lebih lambat.",
  },
];

// Default confidence per kelas, dikalibrasi dari kurva F1/PR per kelas model.
export const DEFAULT_CLASS_CONFIDENCE: Record<string, number> = {
  KTP: 0.35,
  SIM: 0.35,
  Paspor: 0.35,
  NIK_Teks: 0.3,
  Wajah: 0.25,
  Plat_Nomor: 0.35,
};

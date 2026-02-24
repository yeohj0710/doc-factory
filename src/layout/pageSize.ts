export const MM_PER_INCH = 25.4;

export type PageSizePreset = "A4P" | "A4L" | "LETTERP" | "LETTERL" | "CUSTOM";

export type PageSizeSpec = {
  preset: PageSizePreset;
  label: string;
  widthMm: number;
  heightMm: number;
};

const A4_W_MM = 210;
const A4_H_MM = 297;
const LETTER_W_MM = 215.9;
const LETTER_H_MM = 279.4;

export const PAGE_SIZE_PRESETS: Record<Exclude<PageSizePreset, "CUSTOM">, PageSizeSpec> = {
  A4P: {
    preset: "A4P",
    label: "A4 Portrait",
    widthMm: A4_W_MM,
    heightMm: A4_H_MM,
  },
  A4L: {
    preset: "A4L",
    label: "A4 Landscape",
    widthMm: A4_H_MM,
    heightMm: A4_W_MM,
  },
  LETTERP: {
    preset: "LETTERP",
    label: "Letter Portrait",
    widthMm: LETTER_W_MM,
    heightMm: LETTER_H_MM,
  },
  LETTERL: {
    preset: "LETTERL",
    label: "Letter Landscape",
    widthMm: LETTER_H_MM,
    heightMm: LETTER_W_MM,
  },
};

export function resolvePageSize(params: {
  preset?: PageSizePreset;
  widthMm?: number;
  heightMm?: number;
}): PageSizeSpec {
  if (params.preset === "CUSTOM") {
    const widthMm = typeof params.widthMm === "number" ? params.widthMm : PAGE_SIZE_PRESETS.A4P.widthMm;
    const heightMm = typeof params.heightMm === "number" ? params.heightMm : PAGE_SIZE_PRESETS.A4P.heightMm;
    return {
      preset: "CUSTOM",
      label: "Custom",
      widthMm,
      heightMm,
    };
  }

  const preset = params.preset ?? "A4P";
  return PAGE_SIZE_PRESETS[preset as Exclude<PageSizePreset, "CUSTOM">] ?? PAGE_SIZE_PRESETS.A4P;
}

export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * 72;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isLandscape(size: Pick<PageSizeSpec, "widthMm" | "heightMm">): boolean {
  return size.widthMm > size.heightMm;
}


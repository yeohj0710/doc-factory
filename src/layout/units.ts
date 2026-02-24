export const MM_PER_INCH = 25.4;

export const A4_PORTRAIT_MM = {
  widthMm: 210,
  heightMm: 297,
} as const;

export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

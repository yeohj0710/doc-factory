export const PAGE_SIZE_A4_PORTRAIT = {
  widthMm: 210,
  heightMm: 297,
} as const;

export type PageSize = typeof PAGE_SIZE_A4_PORTRAIT;

export type ImageFit = "cover" | "contain";

export type ImageElement = {
  type: "image";
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  srcPublicPath: string;
  fit: ImageFit;
  intrinsicWidthPx?: number;
  intrinsicHeightPx?: number;
  anchorX?: number;
  anchorY?: number;
};

export type TextElement = {
  type: "text";
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  text: string;
  fontSizePt: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
};

export type RectElement = {
  type: "rect";
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fill: string;
  radiusMm?: number;
  stroke?: string;
  strokeWidthMm?: number;
};

export type LineElement = {
  type: "line";
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  stroke: string;
  widthMm: number;
};

export type Element = ImageElement | TextElement | RectElement | LineElement;

export type PageLayout = {
  pageNumber: number;
  elements: Element[];
};

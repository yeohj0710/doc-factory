export const PAGE_SIZE_A4_PORTRAIT = {
  widthMm: 210,
  heightMm: 297,
} as const;

export type PageSize = typeof PAGE_SIZE_A4_PORTRAIT;

export type ImageFit = "cover" | "contain";

export type LayoutElementRole =
  | "background"
  | "media"
  | "text"
  | "chip"
  | "metric"
  | "footer"
  | "decorative";

type ElementMeta = {
  id?: string;
  role?: LayoutElementRole;
  collisionGroup?: string;
  isCollisionProtected?: boolean;
  allowTextOcclusion?: boolean;
};

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
} & ElementMeta;

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
  lineHeight?: number;
} & ElementMeta;

export type RectElement = {
  type: "rect";
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fill: string;
  fillOpacity?: number;
  radiusMm?: number;
  stroke?: string;
  strokeWidthMm?: number;
} & ElementMeta;

export type LineElement = {
  type: "line";
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  stroke: string;
  widthMm: number;
} & ElementMeta;

export type Element = ImageElement | TextElement | RectElement | LineElement;

export type TextBudgetSummary = {
  title: number;
  subtitle: number;
  body: number;
  bullet: number;
  bullets: number;
  callout: number;
};

export type LayoutValidationIssue = {
  code:
    | "boundary"
    | "collision"
    | "minimum-size"
    | "text-fit"
    | "layering"
    | "determinism";
  message: string;
  elementId?: string;
  elementIndex?: number;
};

export type LayoutValidationResult = {
  passed: boolean;
  issues: LayoutValidationIssue[];
  attemptedTemplates: string[];
};

export type PageBriefSummary = {
  sourceImage: string;
  imageCaption: string;
  category: string;
  template: string;
  templateReason: string;
  readingFlow: string;
  maxTextBudget: TextBudgetSummary;
};

export type PageLayout = {
  pageNumber: number;
  elements: Element[];
  meta?: {
    brief: PageBriefSummary;
    validation: LayoutValidationResult;
  };
};

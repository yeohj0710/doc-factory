import type { PageSizePreset } from "@/src/layout/pageSize";

export type DocType = "proposal" | "poster" | "one-pager" | "multi-card" | "report";

export type ImageFit = "cover" | "contain";

export type LayoutElementRole =
  | "background"
  | "header"
  | "footer"
  | "media"
  | "text"
  | "metric"
  | "chip"
  | "decorative"
  | "shape";

type ElementMeta = {
  id?: string;
  role?: LayoutElementRole;
  collisionGroup?: string;
  isCollisionProtected?: boolean;
  allowTextOcclusion?: boolean;
  debugOnly?: boolean;
};

export type ImageElement = ElementMeta & {
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

export type TextElement = ElementMeta & {
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
};

export type RectElement = ElementMeta & {
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
};

export type LineElement = ElementMeta & {
  type: "line";
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  stroke: string;
  widthMm: number;
};

export type Element = ImageElement | TextElement | RectElement | LineElement;

export type TextBudgetSummary = {
  title: number;
  subtitle: number;
  body: number;
  bullet: number;
  bullets: number;
  callout: number;
};

export type PageBriefSummary = {
  pageRole: string;
  sourceImage: string | null;
  imageCaption: string;
  topic: string;
  template: string;
  templateReason: string;
  readingFlow: string;
  maxTextBudget: TextBudgetSummary;
  copyPipelineLog: string[];
};

export type LayoutValidationIssueCode =
  | "boundary"
  | "reserved-lane"
  | "collision"
  | "min-size"
  | "text-truncation"
  | "layering"
  | "determinism"
  | "runtime-overflow"
  | "runtime-clip"
  | "runtime-overlap"
  | "runtime-truncation"
  | "export-audit";

export type LayoutValidationIssue = {
  code: LayoutValidationIssueCode;
  message: string;
  elementId?: string;
  elementIndex?: number;
};

export type RuntimePageValidation = {
  pageNumber: number;
  passed: boolean;
  issues: LayoutValidationIssue[];
};

export type LayoutValidationResult = {
  passed: boolean;
  issues: LayoutValidationIssue[];
  attemptedTemplates: string[];
  runtimeIssues: LayoutValidationIssue[];
};

export type PageLayout = {
  pageNumber: number;
  pageRole: string;
  templateId: string;
  widthMm: number;
  heightMm: number;
  elements: Element[];
  meta?: {
    brief: PageBriefSummary;
    validation: LayoutValidationResult;
  };
};

export type GenerationParams = {
  pageSizePreset: PageSizePreset;
  customPageSize?: {
    widthMm: number;
    heightMm: number;
  };
  docType: DocType;
  stylePresetId: string;
  variantIndex: number;
  seed: number;
  referenceDigest?: string;
  requestHash?: string;
};

export type LayoutDocument = {
  params: GenerationParams;
  pages: PageLayout[];
};


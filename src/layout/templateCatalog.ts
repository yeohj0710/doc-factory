import { PAGE_SIZE_A4_PORTRAIT } from "@/src/layout/types";

export type TemplateId =
  | "COVER_HERO"
  | "AGENDA_EDITORIAL"
  | "TITLE_MEDIA_SAFE"
  | "TWO_COLUMN_MEDIA_TEXT"
  | "PROCESS_FLOW"
  | "METRICS_PROOF"
  | "TEXT_ONLY_EDITORIAL";

export type TextBudget = {
  title: number;
  subtitle: number;
  body: number;
  bullet: number;
  bullets: number;
  callout: number;
};

export type TemplateZone = {
  id: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  purpose:
    | "title"
    | "subtitle"
    | "body"
    | "media"
    | "chips"
    | "metrics"
    | "flow"
    | "callout"
    | "footer";
};

export type TemplateSpec = {
  id: TemplateId;
  label: string;
  intendedUse: string;
  readingFlow: string;
  maxTextBudget: TextBudget;
  fallbackTemplateId: TemplateId;
  isFullBleed: boolean;
  imagePolicy: "required" | "optional" | "none";
  zoneMap: TemplateZone[];
};

const MARGIN = 12;
const FOOTER_HEIGHT = 14;
const FOOTER_TOP = PAGE_SIZE_A4_PORTRAIT.heightMm - MARGIN - FOOTER_HEIGHT;
const CONTENT_BOTTOM = FOOTER_TOP - 6;
const CONTENT_WIDTH = PAGE_SIZE_A4_PORTRAIT.widthMm - MARGIN * 2;

const COMMON_BUDGET: TextBudget = {
  title: 34,
  subtitle: 52,
  body: 120,
  bullet: 20,
  bullets: 4,
  callout: 56,
};

export const TEMPLATE_SPECS: Record<TemplateId, TemplateSpec> = {
  COVER_HERO: {
    id: "COVER_HERO",
    label: "COVER_HERO",
    intendedUse: "표지에서 핵심 메시지와 대표 이미지를 한 번에 전달",
    readingFlow: "키커 → 제목 → 히어로 이미지 → 핵심 포인트",
    maxTextBudget: { ...COMMON_BUDGET, title: 26, subtitle: 42, bullets: 3, bullet: 18, callout: 44 },
    fallbackTemplateId: "TITLE_MEDIA_SAFE",
    isFullBleed: true,
    imagePolicy: "required",
    zoneMap: [
      { id: "hero-title", xMm: MARGIN, yMm: 14, wMm: CONTENT_WIDTH, hMm: 40, purpose: "title" },
      { id: "hero-media", xMm: MARGIN, yMm: 60, wMm: CONTENT_WIDTH, hMm: 132, purpose: "media" },
      { id: "hero-body", xMm: MARGIN, yMm: 198, wMm: CONTENT_WIDTH, hMm: CONTENT_BOTTOM - 198, purpose: "body" },
      { id: "footer-lane", xMm: MARGIN, yMm: FOOTER_TOP, wMm: CONTENT_WIDTH, hMm: FOOTER_HEIGHT, purpose: "footer" },
    ],
  },
  AGENDA_EDITORIAL: {
    id: "AGENDA_EDITORIAL",
    label: "AGENDA_EDITORIAL",
    intendedUse: "목차/섹션 전환용 텍스트 중심 페이지",
    readingFlow: "섹션 타이틀 → 아젠다 리스트 → 진행 기준",
    maxTextBudget: { ...COMMON_BUDGET, title: 24, subtitle: 44, body: 96, bullets: 5, bullet: 18 },
    fallbackTemplateId: "TEXT_ONLY_EDITORIAL",
    isFullBleed: false,
    imagePolicy: "none",
    zoneMap: [
      { id: "agenda-title", xMm: MARGIN, yMm: 22, wMm: CONTENT_WIDTH, hMm: 32, purpose: "title" },
      { id: "agenda-list", xMm: MARGIN, yMm: 64, wMm: CONTENT_WIDTH, hMm: 134, purpose: "body" },
      { id: "agenda-note", xMm: MARGIN, yMm: 204, wMm: CONTENT_WIDTH, hMm: CONTENT_BOTTOM - 204, purpose: "callout" },
      { id: "footer-lane", xMm: MARGIN, yMm: FOOTER_TOP, wMm: CONTENT_WIDTH, hMm: FOOTER_HEIGHT, purpose: "footer" },
    ],
  },
  TITLE_MEDIA_SAFE: {
    id: "TITLE_MEDIA_SAFE",
    label: "TITLE_MEDIA_SAFE",
    intendedUse: "안전한 제목+미디어+불릿 구성",
    readingFlow: "제목 → 미디어 → 핵심 불릿",
    maxTextBudget: { ...COMMON_BUDGET, title: 28, subtitle: 46, body: 110, bullets: 4, bullet: 20 },
    fallbackTemplateId: "TWO_COLUMN_MEDIA_TEXT",
    isFullBleed: false,
    imagePolicy: "optional",
    zoneMap: [
      { id: "safe-title", xMm: MARGIN, yMm: 16, wMm: CONTENT_WIDTH, hMm: 34, purpose: "title" },
      { id: "safe-media", xMm: MARGIN, yMm: 56, wMm: CONTENT_WIDTH, hMm: 122, purpose: "media" },
      { id: "safe-body", xMm: MARGIN, yMm: 184, wMm: CONTENT_WIDTH, hMm: CONTENT_BOTTOM - 184, purpose: "body" },
      { id: "footer-lane", xMm: MARGIN, yMm: FOOTER_TOP, wMm: CONTENT_WIDTH, hMm: FOOTER_HEIGHT, purpose: "footer" },
    ],
  },
  TWO_COLUMN_MEDIA_TEXT: {
    id: "TWO_COLUMN_MEDIA_TEXT",
    label: "TWO_COLUMN_MEDIA_TEXT",
    intendedUse: "UI/서비스 화면과 설명을 병치",
    readingFlow: "타이틀 → 좌측 미디어 → 우측 설명",
    maxTextBudget: { ...COMMON_BUDGET, title: 30, subtitle: 42, body: 96, bullets: 4, bullet: 18 },
    fallbackTemplateId: "TITLE_MEDIA_SAFE",
    isFullBleed: false,
    imagePolicy: "optional",
    zoneMap: [
      { id: "two-title", xMm: MARGIN, yMm: 16, wMm: CONTENT_WIDTH, hMm: 30, purpose: "title" },
      { id: "two-media", xMm: MARGIN, yMm: 52, wMm: 94, hMm: CONTENT_BOTTOM - 52, purpose: "media" },
      { id: "two-body", xMm: MARGIN + 100, yMm: 52, wMm: CONTENT_WIDTH - 100, hMm: CONTENT_BOTTOM - 52, purpose: "body" },
      { id: "footer-lane", xMm: MARGIN, yMm: FOOTER_TOP, wMm: CONTENT_WIDTH, hMm: FOOTER_HEIGHT, purpose: "footer" },
    ],
  },
  PROCESS_FLOW: {
    id: "PROCESS_FLOW",
    label: "PROCESS_FLOW",
    intendedUse: "3~5단계 프로세스 설명",
    readingFlow: "단계 타이틀 → 흐름 카드 → 보조 설명",
    maxTextBudget: { ...COMMON_BUDGET, title: 30, subtitle: 38, body: 90, bullets: 5, bullet: 16 },
    fallbackTemplateId: "TEXT_ONLY_EDITORIAL",
    isFullBleed: false,
    imagePolicy: "optional",
    zoneMap: [
      { id: "flow-title", xMm: MARGIN, yMm: 18, wMm: CONTENT_WIDTH, hMm: 30, purpose: "title" },
      { id: "flow-cards", xMm: MARGIN, yMm: 56, wMm: CONTENT_WIDTH, hMm: 116, purpose: "flow" },
      { id: "flow-body", xMm: MARGIN, yMm: 178, wMm: CONTENT_WIDTH, hMm: CONTENT_BOTTOM - 178, purpose: "body" },
      { id: "footer-lane", xMm: MARGIN, yMm: FOOTER_TOP, wMm: CONTENT_WIDTH, hMm: FOOTER_HEIGHT, purpose: "footer" },
    ],
  },
  METRICS_PROOF: {
    id: "METRICS_PROOF",
    label: "METRICS_PROOF",
    intendedUse: "근거/지표 중심 페이지",
    readingFlow: "핵심 지표 → 근거 설명 → 보조 이미지",
    maxTextBudget: { ...COMMON_BUDGET, title: 28, subtitle: 38, body: 92, bullets: 3, bullet: 18, callout: 48 },
    fallbackTemplateId: "TITLE_MEDIA_SAFE",
    isFullBleed: false,
    imagePolicy: "optional",
    zoneMap: [
      { id: "metrics-title", xMm: MARGIN, yMm: 18, wMm: CONTENT_WIDTH, hMm: 28, purpose: "title" },
      { id: "metrics-cards", xMm: MARGIN, yMm: 54, wMm: CONTENT_WIDTH, hMm: 58, purpose: "metrics" },
      { id: "metrics-body", xMm: MARGIN, yMm: 118, wMm: CONTENT_WIDTH, hMm: CONTENT_BOTTOM - 118, purpose: "body" },
      { id: "footer-lane", xMm: MARGIN, yMm: FOOTER_TOP, wMm: CONTENT_WIDTH, hMm: FOOTER_HEIGHT, purpose: "footer" },
    ],
  },
  TEXT_ONLY_EDITORIAL: {
    id: "TEXT_ONLY_EDITORIAL",
    label: "TEXT_ONLY_EDITORIAL",
    intendedUse: "이미지 의존을 끊는 강한 텍스트 페이지",
    readingFlow: "강조 문장 → 불릿 카드 → 행동 유도",
    maxTextBudget: { ...COMMON_BUDGET, title: 24, subtitle: 40, body: 96, bullets: 5, bullet: 18, callout: 54 },
    fallbackTemplateId: "AGENDA_EDITORIAL",
    isFullBleed: false,
    imagePolicy: "none",
    zoneMap: [
      { id: "editorial-title", xMm: MARGIN, yMm: 20, wMm: CONTENT_WIDTH, hMm: 34, purpose: "title" },
      { id: "editorial-body", xMm: MARGIN, yMm: 62, wMm: CONTENT_WIDTH, hMm: 126, purpose: "body" },
      { id: "editorial-callout", xMm: MARGIN, yMm: 194, wMm: CONTENT_WIDTH, hMm: CONTENT_BOTTOM - 194, purpose: "body" },
      { id: "footer-lane", xMm: MARGIN, yMm: FOOTER_TOP, wMm: CONTENT_WIDTH, hMm: FOOTER_HEIGHT, purpose: "footer" },
    ],
  },
};

export function getTemplateSpec(templateId: TemplateId): TemplateSpec {
  return TEMPLATE_SPECS[templateId];
}

export function getFallbackTemplate(templateId: TemplateId): TemplateId {
  return TEMPLATE_SPECS[templateId].fallbackTemplateId;
}

import type { LayoutTokens } from "@/src/layout/tokens";

export type TemplateId =
  | "COVER_HERO_BAND"
  | "COVER_SPLIT_MEDIA"
  | "SECTION_DIVIDER"
  | "AGENDA_EDITORIAL"
  | "TITLE_MEDIA_SAFE"
  | "TWO_COLUMN_MEDIA_TEXT"
  | "METRICS_GRID"
  | "PROCESS_FLOW"
  | "TIMELINE_STEPS"
  | "COMPARISON_TABLE"
  | "GALLERY_SINGLE"
  | "TEXT_ONLY_EDITORIAL"
  | "CTA_CONTACT"
  | "QUOTE_FOCUS";

export type TextBudget = {
  title: number;
  subtitle: number;
  body: number;
  bullet: number;
  bullets: number;
  callout: number;
};

export type TemplateZonePurpose =
  | "header"
  | "footer"
  | "title"
  | "subtitle"
  | "body"
  | "media"
  | "metrics"
  | "flow"
  | "table"
  | "callout"
  | "chips";

export type TemplateZone = {
  id: string;
  purpose: TemplateZonePurpose;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  reserved?: boolean;
};

export type TemplateSpec = {
  id: TemplateId;
  label: string;
  intendedUse: string;
  acceptableAspectRatios: string;
  readingFlow: string;
  maxTextBudget: TextBudget;
  fallbackTemplateIds: TemplateId[];
  isFullBleed: boolean;
  imagePolicy: "required" | "optional" | "none";
  buildZones: (params: {
    pageWidthMm: number;
    pageHeightMm: number;
    tokens: LayoutTokens;
  }) => TemplateZone[];
};

const COMMON_BUDGET: TextBudget = {
  title: 40,
  subtitle: 58,
  body: 130,
  bullet: 24,
  bullets: 5,
  callout: 62,
};

type Frame = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
};

function frame(id: string, purpose: TemplateZonePurpose, value: Frame, reserved = false): TemplateZone {
  return {
    id,
    purpose,
    reserved,
    ...value,
  };
}

function baseMeasurements(params: {
  pageWidthMm: number;
  pageHeightMm: number;
  tokens: LayoutTokens;
}): {
  margin: number;
  gutter: number;
  headerY: number;
  headerH: number;
  footerY: number;
  footerH: number;
  contentX: number;
  contentW: number;
  contentTop: number;
  contentBottom: number;
  contentH: number;
} {
  const margin = params.tokens.spacingMm.pageMargin;
  const gutter = params.tokens.spacingMm.gutter;
  const headerH = params.tokens.spacingMm.headerHeight;
  const footerH = params.tokens.spacingMm.footerHeight;
  const headerY = margin;
  const footerY = params.pageHeightMm - margin - footerH;
  const contentTop = headerY + headerH + gutter;
  const contentBottom = footerY - gutter;

  return {
    margin,
    gutter,
    headerY,
    headerH,
    footerY,
    footerH,
    contentX: margin,
    contentW: params.pageWidthMm - margin * 2,
    contentTop,
    contentBottom,
    contentH: contentBottom - contentTop,
  };
}

function coverHeroZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const mediaH = m.contentH * 0.52;
  const bodyY = m.contentTop + mediaH + m.gutter;

  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 18 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 20, wMm: m.contentW, hMm: 12 }),
    frame("chips", "chips", { xMm: m.contentX, yMm: m.contentTop + 34, wMm: m.contentW, hMm: 8 }),
    frame("media", "media", { xMm: m.contentX, yMm: m.contentTop + 44, wMm: m.contentW, hMm: mediaH - 44 }),
    frame("body", "body", { xMm: m.contentX, yMm: bodyY, wMm: m.contentW * 0.62, hMm: m.contentBottom - bodyY }),
    frame("metrics", "metrics", {
      xMm: m.contentX + m.contentW * 0.65,
      yMm: bodyY,
      wMm: m.contentW * 0.35,
      hMm: m.contentBottom - bodyY,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function coverSplitZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const leftW = m.contentW * 0.56;
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("media", "media", { xMm: m.contentX, yMm: m.contentTop, wMm: leftW, hMm: m.contentH }),
    frame("title", "title", { xMm: m.contentX + leftW + m.gutter, yMm: m.contentTop, wMm: m.contentW - leftW - m.gutter, hMm: 24 }),
    frame("subtitle", "subtitle", {
      xMm: m.contentX + leftW + m.gutter,
      yMm: m.contentTop + 26,
      wMm: m.contentW - leftW - m.gutter,
      hMm: 14,
    }),
    frame("body", "body", {
      xMm: m.contentX + leftW + m.gutter,
      yMm: m.contentTop + 44,
      wMm: m.contentW - leftW - m.gutter,
      hMm: m.contentH * 0.42,
    }),
    frame("callout", "callout", {
      xMm: m.contentX + leftW + m.gutter,
      yMm: m.contentTop + m.contentH * 0.47,
      wMm: m.contentW - leftW - m.gutter,
      hMm: m.contentH * 0.18,
    }),
    frame("metrics", "metrics", {
      xMm: m.contentX + leftW + m.gutter,
      yMm: m.contentTop + m.contentH * 0.68,
      wMm: m.contentW - leftW - m.gutter,
      hMm: m.contentH * 0.32,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function sectionDividerZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const dividerY = m.contentTop + m.contentH * 0.42;
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: dividerY - 12, wMm: m.contentW, hMm: 16 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: dividerY + 8, wMm: m.contentW, hMm: 10 }),
    frame("callout", "callout", { xMm: m.contentX, yMm: dividerY + 24, wMm: m.contentW, hMm: 24 }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function agendaZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const titleY = m.contentTop;
  const subtitleY = titleY + 18;
  const bodyY = subtitleY + 12;
  const calloutY = m.contentTop + m.contentH * 0.72;
  const bodyH = Math.max(16, calloutY - bodyY - m.gutter);
  const calloutH = Math.max(14, m.contentBottom - calloutY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: titleY, wMm: m.contentW, hMm: 16 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: subtitleY, wMm: m.contentW, hMm: 10 }),
    frame("body", "body", { xMm: m.contentX, yMm: bodyY, wMm: m.contentW, hMm: bodyH }),
    frame("callout", "callout", {
      xMm: m.contentX,
      yMm: calloutY,
      wMm: m.contentW,
      hMm: calloutH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function titleMediaSafeZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const mediaY = m.contentTop + 29;
  const mediaH = m.contentH * 0.42;
  const bodyY = mediaY + mediaH + m.gutter;
  const bodyH = Math.max(16, m.contentH * 0.2);
  const chipsY = bodyY + bodyH + m.gutter;
  const chipsH = 8;
  const metricsY = chipsY + chipsH + m.gutter;
  const metricsH = Math.max(10, m.contentBottom - metricsY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 15 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 16, wMm: m.contentW, hMm: 9 }),
    frame("media", "media", { xMm: m.contentX, yMm: mediaY, wMm: m.contentW, hMm: mediaH }),
    frame("body", "body", {
      xMm: m.contentX,
      yMm: bodyY,
      wMm: m.contentW,
      hMm: bodyH,
    }),
    frame("chips", "chips", {
      xMm: m.contentX,
      yMm: chipsY,
      wMm: m.contentW,
      hMm: chipsH,
    }),
    frame("metrics", "metrics", {
      xMm: m.contentX,
      yMm: metricsY,
      wMm: m.contentW,
      hMm: metricsH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function twoColumnZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const leftW = m.contentW * 0.48;
  const subtitleY = m.contentTop + 17;
  const bodyY = subtitleY + 13;
  const bodyH = m.contentH * 0.35;
  const calloutY = bodyY + bodyH + m.gutter;
  const calloutH = m.contentH * 0.18;
  const metricsY = calloutY + calloutH + m.gutter;
  const metricsH = Math.max(10, m.contentBottom - metricsY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 15 }),
    frame("subtitle", "subtitle", { xMm: m.contentX + leftW + m.gutter, yMm: subtitleY, wMm: m.contentW - leftW - m.gutter, hMm: 11 }),
    frame("media", "media", { xMm: m.contentX, yMm: m.contentTop + 20, wMm: leftW, hMm: m.contentH - 20 }),
    frame("body", "body", {
      xMm: m.contentX + leftW + m.gutter,
      yMm: bodyY,
      wMm: m.contentW - leftW - m.gutter,
      hMm: bodyH,
    }),
    frame("callout", "callout", {
      xMm: m.contentX + leftW + m.gutter,
      yMm: calloutY,
      wMm: m.contentW - leftW - m.gutter,
      hMm: calloutH,
    }),
    frame("metrics", "metrics", {
      xMm: m.contentX + leftW + m.gutter,
      yMm: metricsY,
      wMm: m.contentW - leftW - m.gutter,
      hMm: metricsH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function metricsZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const metricsY = m.contentTop + 28;
  const metricsH = m.contentH * 0.22;
  const bodyY = metricsY + metricsH + m.gutter;
  const bodyH = m.contentH * 0.28;
  const mediaY = bodyY + bodyH + m.gutter;
  const mediaH = Math.max(12, m.contentBottom - mediaY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 14 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 16, wMm: m.contentW, hMm: 9 }),
    frame("metrics", "metrics", { xMm: m.contentX, yMm: metricsY, wMm: m.contentW, hMm: metricsH }),
    frame("body", "body", {
      xMm: m.contentX,
      yMm: bodyY,
      wMm: m.contentW,
      hMm: bodyH,
    }),
    frame("media", "media", {
      xMm: m.contentX,
      yMm: mediaY,
      wMm: m.contentW,
      hMm: mediaH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function flowZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const flowY = m.contentTop + 28;
  const flowH = m.contentH * 0.24;
  const bodyY = flowY + flowH + m.gutter;
  const bodyH = m.contentH * 0.3;
  const calloutY = bodyY + bodyH + m.gutter;
  const calloutH = Math.max(12, m.contentBottom - calloutY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 14 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 16, wMm: m.contentW, hMm: 9 }),
    frame("flow", "flow", { xMm: m.contentX, yMm: flowY, wMm: m.contentW, hMm: flowH }),
    frame("body", "body", {
      xMm: m.contentX,
      yMm: bodyY,
      wMm: m.contentW,
      hMm: bodyH,
    }),
    frame("callout", "callout", {
      xMm: m.contentX,
      yMm: calloutY,
      wMm: m.contentW,
      hMm: calloutH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function timelineZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const flowY = m.contentTop + 30;
  const flowH = m.contentH * 0.18;
  const tableY = flowY + flowH + m.gutter;
  const tableH = m.contentH * 0.38;
  const calloutY = tableY + tableH + m.gutter;
  const calloutH = Math.max(12, m.contentBottom - calloutY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 14 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 16, wMm: m.contentW, hMm: 9 }),
    frame("flow", "flow", { xMm: m.contentX, yMm: flowY, wMm: m.contentW, hMm: flowH }),
    frame("table", "table", { xMm: m.contentX, yMm: tableY, wMm: m.contentW, hMm: tableH }),
    frame("callout", "callout", {
      xMm: m.contentX,
      yMm: calloutY,
      wMm: m.contentW,
      hMm: calloutH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function comparisonZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const tableY = m.contentTop + 28;
  const tableH = m.contentH * 0.46;
  const bodyY = tableY + tableH + m.gutter;
  const bodyH = m.contentH * 0.16;
  const calloutY = bodyY + bodyH + m.gutter;
  const calloutH = Math.max(10, m.contentBottom - calloutY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 14 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 16, wMm: m.contentW, hMm: 9 }),
    frame("table", "table", { xMm: m.contentX, yMm: tableY, wMm: m.contentW, hMm: tableH }),
    frame("body", "body", {
      xMm: m.contentX,
      yMm: bodyY,
      wMm: m.contentW,
      hMm: bodyH,
    }),
    frame("callout", "callout", {
      xMm: m.contentX,
      yMm: calloutY,
      wMm: m.contentW,
      hMm: calloutH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function galleryZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 12 }),
    frame("media", "media", { xMm: m.contentX, yMm: m.contentTop + 16, wMm: m.contentW, hMm: m.contentH * 0.72 }),
    frame("callout", "callout", {
      xMm: m.contentX,
      yMm: m.contentTop + m.contentH * 0.74,
      wMm: m.contentW,
      hMm: m.contentH * 0.26,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function textOnlyZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const bodyY = m.contentTop + 33;
  const bodyH = m.contentH * 0.38;
  const tableY = bodyY + bodyH + m.gutter;
  const tableH = m.contentH * 0.22;
  const calloutY = tableY + tableH + m.gutter;
  const calloutH = Math.max(10, m.contentBottom - calloutY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop, wMm: m.contentW, hMm: 16 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 18, wMm: m.contentW, hMm: 11 }),
    frame("body", "body", { xMm: m.contentX, yMm: bodyY, wMm: m.contentW, hMm: bodyH }),
    frame("table", "table", { xMm: m.contentX, yMm: tableY, wMm: m.contentW, hMm: tableH }),
    frame("callout", "callout", {
      xMm: m.contentX,
      yMm: calloutY,
      wMm: m.contentW,
      hMm: calloutH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function ctaZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  const bodyY = m.contentTop + 38;
  const bodyH = m.contentH * 0.24;
  const metricsY = bodyY + bodyH + m.gutter;
  const metricsH = m.contentH * 0.18;
  const calloutY = metricsY + metricsH + m.gutter;
  const calloutH = Math.max(12, m.contentBottom - calloutY);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop + 6, wMm: m.contentW, hMm: 16 }),
    frame("subtitle", "subtitle", { xMm: m.contentX, yMm: m.contentTop + 24, wMm: m.contentW, hMm: 10 }),
    frame("body", "body", { xMm: m.contentX, yMm: bodyY, wMm: m.contentW, hMm: bodyH }),
    frame("metrics", "metrics", {
      xMm: m.contentX,
      yMm: metricsY,
      wMm: m.contentW,
      hMm: metricsH,
    }),
    frame("callout", "callout", {
      xMm: m.contentX,
      yMm: calloutY,
      wMm: m.contentW,
      hMm: calloutH,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

function quoteZones(params: { pageWidthMm: number; pageHeightMm: number; tokens: LayoutTokens }): TemplateZone[] {
  const m = baseMeasurements(params);
  return [
    frame("reserved-header", "header", { xMm: m.contentX, yMm: m.headerY, wMm: m.contentW, hMm: m.headerH }, true),
    frame("title", "title", { xMm: m.contentX, yMm: m.contentTop + 6, wMm: m.contentW, hMm: 14 }),
    frame("callout", "callout", { xMm: m.contentX, yMm: m.contentTop + 24, wMm: m.contentW, hMm: m.contentH * 0.42 }),
    frame("body", "body", {
      xMm: m.contentX,
      yMm: m.contentTop + m.contentH * 0.49,
      wMm: m.contentW,
      hMm: m.contentH * 0.29,
    }),
    frame("metrics", "metrics", {
      xMm: m.contentX,
      yMm: m.contentTop + m.contentH * 0.8,
      wMm: m.contentW,
      hMm: m.contentH * 0.2,
    }),
    frame("reserved-footer", "footer", { xMm: m.contentX, yMm: m.footerY, wMm: m.contentW, hMm: m.footerH }, true),
  ];
}

export const TEMPLATE_SPECS: Record<TemplateId, TemplateSpec> = {
  COVER_HERO_BAND: {
    id: "COVER_HERO_BAND",
    label: "Cover Hero Band",
    intendedUse: "Cover page with title + hero image + proof cards",
    acceptableAspectRatios: "portrait, square, wide",
    readingFlow: "kicker -> title -> media -> body -> metrics",
    maxTextBudget: { ...COMMON_BUDGET, title: 30, subtitle: 42, body: 90, bullets: 3, bullet: 18, callout: 44 },
    fallbackTemplateIds: ["COVER_SPLIT_MEDIA", "TITLE_MEDIA_SAFE", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: true,
    imagePolicy: "required",
    buildZones: coverHeroZones,
  },
  COVER_SPLIT_MEDIA: {
    id: "COVER_SPLIT_MEDIA",
    label: "Cover Split Media",
    intendedUse: "Cover with left media and right narrative",
    acceptableAspectRatios: "portrait, landscape",
    readingFlow: "media -> title -> body -> callout",
    maxTextBudget: { ...COMMON_BUDGET, title: 28, subtitle: 40, body: 100, bullets: 4 },
    fallbackTemplateIds: ["TITLE_MEDIA_SAFE", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: true,
    imagePolicy: "required",
    buildZones: coverSplitZones,
  },
  SECTION_DIVIDER: {
    id: "SECTION_DIVIDER",
    label: "Section Divider",
    intendedUse: "Section transition with short text emphasis",
    acceptableAspectRatios: "all",
    readingFlow: "title -> subtitle -> callout",
    maxTextBudget: { ...COMMON_BUDGET, title: 22, subtitle: 36, body: 40, bullets: 2, bullet: 18, callout: 50 },
    fallbackTemplateIds: ["QUOTE_FOCUS", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: true,
    imagePolicy: "none",
    buildZones: sectionDividerZones,
  },
  AGENDA_EDITORIAL: {
    id: "AGENDA_EDITORIAL",
    label: "Agenda Editorial",
    intendedUse: "Agenda and editorial framing page",
    acceptableAspectRatios: "all",
    readingFlow: "title -> agenda bullets -> context",
    maxTextBudget: { ...COMMON_BUDGET, title: 24, subtitle: 42, body: 120, bullets: 7, bullet: 24, callout: 58 },
    fallbackTemplateIds: ["TEXT_ONLY_EDITORIAL", "QUOTE_FOCUS"],
    isFullBleed: false,
    imagePolicy: "none",
    buildZones: agendaZones,
  },
  TITLE_MEDIA_SAFE: {
    id: "TITLE_MEDIA_SAFE",
    label: "Title Media Safe",
    intendedUse: "Safe title + single media + summary",
    acceptableAspectRatios: "all",
    readingFlow: "title -> media -> summary",
    maxTextBudget: { ...COMMON_BUDGET, title: 28, subtitle: 44, body: 108, bullets: 4, bullet: 20 },
    fallbackTemplateIds: ["TWO_COLUMN_MEDIA_TEXT", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: false,
    imagePolicy: "optional",
    buildZones: titleMediaSafeZones,
  },
  TWO_COLUMN_MEDIA_TEXT: {
    id: "TWO_COLUMN_MEDIA_TEXT",
    label: "Two Column Media Text",
    intendedUse: "UI screenshot + narrative split layout",
    acceptableAspectRatios: "portrait, long screenshot",
    readingFlow: "title -> media -> text column",
    maxTextBudget: { ...COMMON_BUDGET, title: 28, subtitle: 40, body: 92, bullets: 4, bullet: 19, callout: 46 },
    fallbackTemplateIds: ["TITLE_MEDIA_SAFE", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: false,
    imagePolicy: "optional",
    buildZones: twoColumnZones,
  },
  METRICS_GRID: {
    id: "METRICS_GRID",
    label: "Metrics Grid",
    intendedUse: "KPI heavy page with support detail",
    acceptableAspectRatios: "all",
    readingFlow: "title -> metric cards -> evidence",
    maxTextBudget: { ...COMMON_BUDGET, title: 26, subtitle: 36, body: 88, bullets: 4, bullet: 18, callout: 42 },
    fallbackTemplateIds: ["COMPARISON_TABLE", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: false,
    imagePolicy: "optional",
    buildZones: metricsZones,
  },
  PROCESS_FLOW: {
    id: "PROCESS_FLOW",
    label: "Process Flow",
    intendedUse: "Process and implementation sequence",
    acceptableAspectRatios: "all",
    readingFlow: "title -> flow -> explanation",
    maxTextBudget: { ...COMMON_BUDGET, title: 26, subtitle: 36, body: 84, bullets: 5, bullet: 18, callout: 48 },
    fallbackTemplateIds: ["TIMELINE_STEPS", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: false,
    imagePolicy: "none",
    buildZones: flowZones,
  },
  TIMELINE_STEPS: {
    id: "TIMELINE_STEPS",
    label: "Timeline Steps",
    intendedUse: "Milestone-oriented timeline page",
    acceptableAspectRatios: "all",
    readingFlow: "title -> timeline -> detail table",
    maxTextBudget: { ...COMMON_BUDGET, title: 26, subtitle: 36, body: 82, bullets: 5, bullet: 18, callout: 46 },
    fallbackTemplateIds: ["PROCESS_FLOW", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: false,
    imagePolicy: "none",
    buildZones: timelineZones,
  },
  COMPARISON_TABLE: {
    id: "COMPARISON_TABLE",
    label: "Comparison Table",
    intendedUse: "Options comparison / before-after view",
    acceptableAspectRatios: "all",
    readingFlow: "title -> comparison grid -> conclusion",
    maxTextBudget: { ...COMMON_BUDGET, title: 26, subtitle: 34, body: 80, bullets: 4, bullet: 18, callout: 44 },
    fallbackTemplateIds: ["TEXT_ONLY_EDITORIAL", "AGENDA_EDITORIAL"],
    isFullBleed: false,
    imagePolicy: "none",
    buildZones: comparisonZones,
  },
  GALLERY_SINGLE: {
    id: "GALLERY_SINGLE",
    label: "Gallery Single",
    intendedUse: "Single image spotlight page",
    acceptableAspectRatios: "portrait, landscape, square",
    readingFlow: "title -> image -> caption",
    maxTextBudget: { ...COMMON_BUDGET, title: 24, subtitle: 24, body: 56, bullets: 2, bullet: 18, callout: 40 },
    fallbackTemplateIds: ["TITLE_MEDIA_SAFE", "TEXT_ONLY_EDITORIAL"],
    isFullBleed: true,
    imagePolicy: "required",
    buildZones: galleryZones,
  },
  TEXT_ONLY_EDITORIAL: {
    id: "TEXT_ONLY_EDITORIAL",
    label: "Text Only Editorial",
    intendedUse: "Text-first argument page",
    acceptableAspectRatios: "all",
    readingFlow: "title -> body -> highlighted takeaways",
    maxTextBudget: { ...COMMON_BUDGET, title: 24, subtitle: 40, body: 104, bullets: 6, bullet: 19, callout: 56 },
    fallbackTemplateIds: ["AGENDA_EDITORIAL", "QUOTE_FOCUS"],
    isFullBleed: false,
    imagePolicy: "none",
    buildZones: textOnlyZones,
  },
  CTA_CONTACT: {
    id: "CTA_CONTACT",
    label: "CTA Contact",
    intendedUse: "Final action and contact summary",
    acceptableAspectRatios: "all",
    readingFlow: "title -> checklist -> call-to-action",
    maxTextBudget: { ...COMMON_BUDGET, title: 24, subtitle: 36, body: 72, bullets: 5, bullet: 18, callout: 54 },
    fallbackTemplateIds: ["TEXT_ONLY_EDITORIAL", "QUOTE_FOCUS"],
    isFullBleed: false,
    imagePolicy: "none",
    buildZones: ctaZones,
  },
  QUOTE_FOCUS: {
    id: "QUOTE_FOCUS",
    label: "Quote Focus",
    intendedUse: "Single key message with supporting notes",
    acceptableAspectRatios: "all",
    readingFlow: "title -> quote -> support",
    maxTextBudget: { ...COMMON_BUDGET, title: 20, subtitle: 20, body: 82, bullets: 4, bullet: 18, callout: 64 },
    fallbackTemplateIds: ["TEXT_ONLY_EDITORIAL", "AGENDA_EDITORIAL"],
    isFullBleed: false,
    imagePolicy: "none",
    buildZones: quoteZones,
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATE_SPECS) as TemplateId[];

export function getTemplateSpec(templateId: TemplateId): TemplateSpec {
  return TEMPLATE_SPECS[templateId];
}

export function getTemplateFallbackChain(templateId: TemplateId): TemplateId[] {
  const first = TEMPLATE_SPECS[templateId];
  if (!first) {
    return ["TEXT_ONLY_EDITORIAL"];
  }

  const chain: TemplateId[] = [templateId];
  for (const fallback of first.fallbackTemplateIds) {
    if (!chain.includes(fallback)) {
      chain.push(fallback);
    }
  }

  if (!chain.includes("TEXT_ONLY_EDITORIAL")) {
    chain.push("TEXT_ONLY_EDITORIAL");
  }

  return chain;
}

export function isFullBleedTemplate(templateId: TemplateId): boolean {
  return TEMPLATE_SPECS[templateId]?.isFullBleed ?? false;
}

export function templateSupportsImage(templateId: TemplateId, hasAsset: boolean): boolean {
  const policy = TEMPLATE_SPECS[templateId]?.imagePolicy;
  if (policy === "required") {
    return hasAsset;
  }
  return true;
}


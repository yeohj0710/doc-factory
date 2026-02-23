import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";
import type { LayoutTokens } from "@/src/layout/tokens";
import {
  PAGE_SIZE_A4_PORTRAIT,
  type Element,
  type ImageElement,
  type PageLayout,
} from "@/src/layout/types";

type TemplateKey =
  | "hero-ribbon"
  | "editorial-split"
  | "insight-grid"
  | "framed-focus"
  | "dual-panels";

type MetricCard = {
  label: string;
  value: string;
};

type Narrative = {
  kicker: string;
  title: string;
  summary: string;
  bulletsA: string[];
  bulletsB: string[];
  callout: string;
  footer: string;
  metrics: MetricCard[];
};

const PAGE_W = PAGE_SIZE_A4_PORTRAIT.widthMm;
const PAGE_H = PAGE_SIZE_A4_PORTRAIT.heightMm;

const KICKERS = [
  "PROGRAM OVERVIEW",
  "SERVICE BLUEPRINT",
  "WELLNESS DELIVERY",
  "EXPERIENCE SNAPSHOT",
  "OPERATIONS FLOW",
] as const;

const SUMMARIES = [
  "A modular page generated from the source image with consistent A4 structure.",
  "Typography, spacing, and components are tuned for readable presentation pages.",
  "The same layout model powers web preview and PPTX export for visual parity.",
  "Each element stays editable in PowerPoint while preserving overall composition.",
  "Deterministic rules keep regeneration stable during iterative design cycles.",
] as const;

const BULLETS = [
  "Stronger type scale for improved readability",
  "Strict margin grid for cleaner composition",
  "Aspect-ratio-safe image framing",
  "Modular cards with high information density",
  "Deterministic ordering and regeneration",
  "Editable text and shape layers in PPTX",
  "Balanced visual hierarchy across templates",
  "Reusable blocks for repeated design iterations",
] as const;

const CALLOUTS = [
  "Design objective: preview and export should be visually equivalent.",
  "Layout objective: richer pages with a stronger typographic voice.",
  "Production objective: repeatable templates for fast iteration.",
  "Quality objective: no stretched images, no accidental distortion.",
  "Workflow objective: image-first input and editable A4 output.",
] as const;

const FOOTERS = [
  "Web-to-PPTX fidelity",
  "Deterministic A4 composition",
  "Image-first document engine",
  "Editable presentation output",
  "Template-driven page builder",
] as const;

const METRIC_LABELS = ["Cadence", "Format", "Output", "Review", "Channel", "Quality"] as const;
const METRIC_VALUES = ["Monthly", "A4 Portrait", "Editable", "Iterative", "Preview + PPTX", "Design System"] as const;

const DEFAULT_CYCLE: TemplateKey[] = [
  "hero-ribbon",
  "editorial-split",
  "insight-grid",
  "framed-focus",
  "dual-panels",
];

const LANDSCAPE_CYCLE: TemplateKey[] = [
  "hero-ribbon",
  "insight-grid",
  "dual-panels",
  "editorial-split",
  "framed-focus",
];

const PORTRAIT_CYCLE: TemplateKey[] = [
  "editorial-split",
  "framed-focus",
  "hero-ribbon",
  "dual-panels",
  "insight-grid",
];

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function pickWindow(values: readonly string[], index: number, count: number): string[] {
  return Array.from({ length: count }, (_, offset) => values[(index + offset) % values.length]);
}

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function bullets(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  const withoutPrefix = stem.replace(
    /^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i,
    "",
  );

  const normalized = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length > 0) {
    return normalized;
  }
  const fallback = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return fallback || "Untitled image";
}

function buildNarrative(caption: string, index: number): Narrative {
  return {
    kicker: pick(KICKERS, index),
    title: shortText(caption, 56),
    summary: pick(SUMMARIES, index),
    bulletsA: pickWindow(BULLETS, index, 3),
    bulletsB: pickWindow(BULLETS, index + 3, 3),
    callout: pick(CALLOUTS, index),
    footer: `${pick(FOOTERS, index)} | ${shortText(caption, 32)}`,
    metrics: [
      { label: pick(METRIC_LABELS, index), value: pick(METRIC_VALUES, index) },
      { label: pick(METRIC_LABELS, index + 2), value: pick(METRIC_VALUES, index + 2) },
      { label: pick(METRIC_LABELS, index + 4), value: pick(METRIC_VALUES, index + 4) },
    ],
  };
}

function pickTemplate(image: ScannedImage, index: number): TemplateKey {
  const width = image.widthPx ?? 1;
  const height = image.heightPx ?? 1;
  const ratio = width / height;
  if (ratio >= 1.2) {
    return LANDSCAPE_CYCLE[index % LANDSCAPE_CYCLE.length];
  }
  if (ratio <= 0.85) {
    return PORTRAIT_CYCLE[index % PORTRAIT_CYCLE.length];
  }
  return DEFAULT_CYCLE[index % DEFAULT_CYCLE.length];
}

type ImageFrame = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fit: "cover" | "contain";
};

function imageElement(image: ScannedImage, frame: ImageFrame): ImageElement {
  return {
    type: "image",
    xMm: frame.xMm,
    yMm: frame.yMm,
    wMm: frame.wMm,
    hMm: frame.hMm,
    srcPublicPath: image.publicPath,
    fit: frame.fit,
    intrinsicWidthPx: image.widthPx,
    intrinsicHeightPx: image.heightPx,
    anchorX: 0.5,
    anchorY: 0.5,
  };
}

function addPageFooter(elements: Element[], narrative: Narrative, tokens: LayoutTokens): void {
  const margin = tokens.spacingMm.pageMargin;
  elements.push(
    {
      type: "line",
      x1Mm: margin,
      y1Mm: 282,
      x2Mm: PAGE_W - margin,
      y2Mm: 282,
      stroke: tokens.colors.border,
      widthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 285,
      wMm: PAGE_W - margin * 2,
      hMm: 8,
      text: narrative.footer,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.mutedText,
    },
  );
}

function buildHeroRibbon(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const metricX = 146;
  const metricW = PAGE_W - metricX - margin;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 86, fill: tokens.colors.softAccentAlt },
    { type: "rect", xMm: 0, yMm: 0, wMm: 8, hMm: 86, fill: tokens.colors.accent },
    {
      type: "text",
      xMm: margin + 2,
      yMm: 10,
      wMm: 130,
      hMm: 8,
      text: narrative.kicker,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.accentDeep,
    },
    {
      type: "text",
      xMm: margin + 2,
      yMm: 20,
      wMm: 130,
      hMm: 28,
      text: narrative.title,
      fontSizePt: tokens.fontScalePt.title,
      bold: true,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: margin + 2,
      yMm: 56,
      wMm: 132,
      hMm: 18,
      text: narrative.summary,
      fontSizePt: tokens.fontScalePt.body,
      color: tokens.colors.mutedText,
    },
  ];

  narrative.metrics.forEach((metric, index) => {
    const y = 12 + index * 24;
    elements.push(
      {
        type: "rect",
        xMm: metricX,
        yMm: y,
        wMm: metricW,
        hMm: 20,
        fill: tokens.colors.page,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
      },
      {
        type: "text",
        xMm: metricX + 4,
        yMm: y + 4,
        wMm: metricW - 8,
        hMm: 6,
        text: metric.label,
        fontSizePt: tokens.fontScalePt.micro,
        bold: true,
        color: tokens.colors.mutedText,
      },
      {
        type: "text",
        xMm: metricX + 4,
        yMm: y + 9,
        wMm: metricW - 8,
        hMm: 8,
        text: metric.value,
        fontSizePt: tokens.fontScalePt.caption,
        bold: true,
        color: tokens.colors.accentDeep,
      },
    );
  });

  elements.push(
    imageElement(image, { xMm: margin, yMm: 92, wMm: PAGE_W - margin * 2, hMm: 132, fit: "cover" }),
    { type: "rect", xMm: margin, yMm: 194, wMm: PAGE_W - margin * 2, hMm: 22, fill: tokens.colors.accentDeep },
    {
      type: "text",
      xMm: margin + 5,
      yMm: 200,
      wMm: PAGE_W - margin * 2 - 10,
      hMm: 12,
      text: narrative.callout,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.inverseText,
    },
    {
      type: "rect",
      xMm: margin,
      yMm: 230,
      wMm: PAGE_W - margin * 2,
      hMm: 40,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 5,
      yMm: 236,
      wMm: PAGE_W - margin * 2 - 10,
      hMm: 30,
      text: bullets(narrative.bulletsA),
      fontSizePt: tokens.fontScalePt.caption,
      color: tokens.colors.text,
    },
  );
  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildEditorialSplit(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = tokens.spacingMm.gutter;
  const leftW = 78;
  const rightX = margin + leftW + gutter;
  const rightW = PAGE_W - margin - rightX;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: margin, yMm: margin, wMm: leftW, hMm: PAGE_H - margin * 2, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    { type: "rect", xMm: margin, yMm: margin, wMm: 4, hMm: PAGE_H - margin * 2, fill: tokens.colors.accent, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 7, yMm: 17, wMm: leftW - 11, hMm: 8, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin + 7, yMm: 28, wMm: leftW - 11, hMm: 32, text: narrative.title, fontSizePt: tokens.fontScalePt.subtitle, bold: true, color: tokens.colors.text },
    { type: "text", xMm: margin + 7, yMm: 62, wMm: leftW - 11, hMm: 24, text: narrative.summary, fontSizePt: tokens.fontScalePt.caption, color: tokens.colors.mutedText },
    { type: "rect", xMm: margin + 7, yMm: 98, wMm: leftW - 14, hMm: 44, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: margin + 11, yMm: 104, wMm: leftW - 22, hMm: 34, text: bullets(narrative.bulletsA), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "rect", xMm: margin + 7, yMm: 149, wMm: leftW - 14, hMm: 38, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: margin + 11, yMm: 155, wMm: leftW - 22, hMm: 28, text: bullets(narrative.bulletsB.slice(0, 2)), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "rect", xMm: margin + 7, yMm: 194, wMm: leftW - 14, hMm: 83, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 11, yMm: 201, wMm: leftW - 22, hMm: 70, text: narrative.callout, fontSizePt: tokens.fontScalePt.caption, color: tokens.colors.inverseText },
    { type: "rect", xMm: rightX, yMm: margin, wMm: rightW, hMm: 174, fill: tokens.colors.softAccentAlt, radiusMm: tokens.radiusMm.md },
    imageElement(image, { xMm: rightX + 2, yMm: margin + 2, wMm: rightW - 4, hMm: 170, fit: "cover" }),
    { type: "rect", xMm: rightX, yMm: 188, wMm: rightW, hMm: 54, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: rightX + 5, yMm: 194, wMm: rightW - 10, hMm: 42, text: shortText(narrative.summary, 130), fontSizePt: tokens.fontScalePt.body, bold: true, color: tokens.colors.inverseText },
  ];

  const cardW = (rightW - 4) / 3;
  narrative.metrics.forEach((metric, index) => {
    const x = rightX + index * (cardW + 2);
    elements.push(
      { type: "rect", xMm: x, yMm: 248, wMm: cardW, hMm: 28, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: x + 3, yMm: 254, wMm: cardW - 6, hMm: 18, text: `${metric.label}\n${metric.value}`, fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildInsightGrid(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const cardGap = 4;
  const width = PAGE_W - margin * 2;
  const cardW = (width - cardGap * 2) / 3;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    imageElement(image, { xMm: margin, yMm: margin, wMm: width, hMm: 108, fit: "cover" }),
    { type: "rect", xMm: margin, yMm: 122, wMm: width, hMm: 33, fill: tokens.colors.softAccentAlt, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 4, yMm: 127, wMm: width - 8, hMm: 7, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin + 4, yMm: 134, wMm: width - 8, hMm: 16, text: narrative.title, fontSizePt: tokens.fontScalePt.lead, bold: true, color: tokens.colors.text },
    { type: "rect", xMm: margin, yMm: 220, wMm: width, hMm: 26, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 5, yMm: 227, wMm: width - 10, hMm: 14, text: narrative.callout, fontSizePt: tokens.fontScalePt.caption, bold: true, color: tokens.colors.inverseText },
    { type: "rect", xMm: margin, yMm: 251, wMm: 92, hMm: 26, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "rect", xMm: margin + 98, yMm: 251, wMm: 92, hMm: 26, fill: tokens.colors.page, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: margin + 4, yMm: 257, wMm: 84, hMm: 16, text: `${narrative.metrics[0].label}: ${narrative.metrics[0].value}\n${narrative.metrics[1].label}: ${narrative.metrics[1].value}`, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "text", xMm: margin + 102, yMm: 257, wMm: 84, hMm: 16, text: `${narrative.metrics[2].label}: ${narrative.metrics[2].value}\n${narrative.kicker}`, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
  ];

  const cardLines = [
    [narrative.bulletsA[0], narrative.bulletsA[1]],
    [narrative.bulletsA[2], narrative.bulletsB[0]],
    [narrative.bulletsB[1], narrative.bulletsB[2]],
  ];
  cardLines.forEach((lines, index) => {
    const x = margin + index * (cardW + cardGap);
    elements.push(
      { type: "rect", xMm: x, yMm: 161, wMm: cardW, hMm: 53, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: x + 3, yMm: 167, wMm: cardW - 6, hMm: 43, text: bullets(lines), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildFramedFocus(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const railW = 46;
  const frameX = 62;
  const frameY = 40;
  const frameW = 98;
  const frameH = 172;
  const rightX = 166;
  const rightW = PAGE_W - margin - rightX;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: margin, yMm: margin, wMm: railW, hMm: PAGE_H - margin * 2, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    { type: "text", xMm: margin + 4, yMm: 18, wMm: railW - 8, hMm: 8, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin + 4, yMm: 29, wMm: railW - 8, hMm: 35, text: shortText(narrative.title, 28), fontSizePt: tokens.fontScalePt.caption, bold: true, color: tokens.colors.text },
    { type: "text", xMm: margin + 4, yMm: 70, wMm: railW - 8, hMm: 58, text: bullets(narrative.bulletsA), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.mutedText },
    { type: "rect", xMm: margin + 4, yMm: 210, wMm: railW - 8, hMm: 67, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 7, yMm: 216, wMm: railW - 14, hMm: 54, text: shortText(narrative.callout, 120), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.inverseText },
    { type: "rect", xMm: frameX - 4, yMm: frameY - 4, wMm: frameW + 8, hMm: frameH + 8, fill: tokens.colors.softAccentAlt, radiusMm: tokens.radiusMm.lg },
    { type: "rect", xMm: frameX - 1, yMm: frameY - 1, wMm: frameW + 2, hMm: frameH + 2, fill: tokens.colors.page, radiusMm: tokens.radiusMm.md, stroke: tokens.colors.border, strokeWidthMm: 0.35 },
    imageElement(image, { xMm: frameX, yMm: frameY, wMm: frameW, hMm: frameH, fit: "cover" }),
    { type: "rect", xMm: frameX, yMm: frameY + frameH - 28, wMm: frameW, hMm: 22, fill: tokens.colors.accentDeep },
    { type: "text", xMm: frameX + 4, yMm: frameY + frameH - 22, wMm: frameW - 8, hMm: 12, text: shortText(narrative.summary, 90), fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.inverseText },
    { type: "rect", xMm: frameX, yMm: 220, wMm: frameW, hMm: 57, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
    { type: "text", xMm: frameX + 4, yMm: 226, wMm: frameW - 8, hMm: 47, text: bullets(narrative.bulletsB), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    { type: "rect", xMm: rightX, yMm: 156, wMm: rightW, hMm: 121, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: rightX + 3, yMm: 163, wMm: rightW - 6, hMm: 108, text: bullets(narrative.bulletsA.concat(narrative.bulletsB)), fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.inverseText },
  ];

  narrative.metrics.forEach((metric, index) => {
    const y = 40 + index * 38;
    elements.push(
      { type: "rect", xMm: rightX, yMm: y, wMm: rightW, hMm: 32, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: rightX + 3, yMm: y + 9, wMm: rightW - 6, hMm: 18, text: `${metric.label}\n${metric.value}`, fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildDualPanels(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const panelGap = 6;
  const panelW = (PAGE_W - margin * 2 - panelGap) / 2;
  const panelY = 44;
  const panelH = 112;
  const cardGap = 4;
  const cardW = (PAGE_W - margin * 2 - cardGap * 2) / 3;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 34, fill: tokens.colors.softAccentAlt },
    { type: "text", xMm: margin, yMm: 8, wMm: PAGE_W - margin * 2, hMm: 8, text: narrative.kicker, fontSizePt: tokens.fontScalePt.micro, bold: true, color: tokens.colors.accentDeep },
    { type: "text", xMm: margin, yMm: 16, wMm: PAGE_W - margin * 2, hMm: 14, text: narrative.title, fontSizePt: tokens.fontScalePt.subtitle, bold: true, color: tokens.colors.text },
    { type: "rect", xMm: margin, yMm: panelY, wMm: panelW, hMm: panelH, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    { type: "rect", xMm: margin + panelW + panelGap, yMm: panelY, wMm: panelW, hMm: panelH, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.md },
    imageElement(image, { xMm: margin + 2, yMm: panelY + 2, wMm: panelW - 4, hMm: panelH - 4, fit: "cover" }),
    imageElement(image, { xMm: margin + panelW + panelGap + 2, yMm: panelY + 2, wMm: panelW - 4, hMm: panelH - 4, fit: "contain" }),
    { type: "rect", xMm: margin + 6, yMm: panelY + 6, wMm: 26, hMm: 10, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + 8, yMm: panelY + 9, wMm: 22, hMm: 6, text: "Cover", fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.inverseText },
    { type: "rect", xMm: margin + panelW + panelGap + 6, yMm: panelY + 6, wMm: 30, hMm: 10, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.sm },
    { type: "text", xMm: margin + panelW + panelGap + 8, yMm: panelY + 9, wMm: 26, hMm: 6, text: "Contain", fontSizePt: tokens.fontScalePt.micro, bold: true, align: "center", color: tokens.colors.inverseText },
    { type: "rect", xMm: margin, yMm: 164, wMm: PAGE_W - margin * 2, hMm: 40, fill: tokens.colors.accentDeep, radiusMm: tokens.radiusMm.md },
    { type: "text", xMm: margin + 6, yMm: 171, wMm: PAGE_W - margin * 2 - 12, hMm: 11, text: narrative.summary, fontSizePt: tokens.fontScalePt.body, bold: true, color: tokens.colors.inverseText },
    { type: "text", xMm: margin + 6, yMm: 184, wMm: PAGE_W - margin * 2 - 12, hMm: 14, text: narrative.callout, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.inverseText },
  ];

  const cardText = [
    bullets(narrative.bulletsA),
    bullets(narrative.bulletsB),
    `${narrative.metrics[0].label}: ${narrative.metrics[0].value}\n${narrative.metrics[1].label}: ${narrative.metrics[1].value}\n${narrative.metrics[2].label}: ${narrative.metrics[2].value}`,
  ];
  cardText.forEach((text, index) => {
    const x = margin + index * (cardW + cardGap);
    elements.push(
      { type: "rect", xMm: x, yMm: 210, wMm: cardW, hMm: 66, fill: tokens.colors.softAccent, radiusMm: tokens.radiusMm.sm, stroke: tokens.colors.border, strokeWidthMm: 0.3 },
      { type: "text", xMm: x + 4, yMm: 216, wMm: cardW - 8, hMm: 54, text, fontSizePt: tokens.fontScalePt.micro, color: tokens.colors.text },
    );
  });

  addPageFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildPage(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
  template: TemplateKey,
): PageLayout {
  if (template === "hero-ribbon") {
    return buildHeroRibbon(image, narrative, pageNumber, tokens);
  }
  if (template === "editorial-split") {
    return buildEditorialSplit(image, narrative, pageNumber, tokens);
  }
  if (template === "insight-grid") {
    return buildInsightGrid(image, narrative, pageNumber, tokens);
  }
  if (template === "framed-focus") {
    return buildFramedFocus(image, narrative, pageNumber, tokens);
  }
  return buildDualPanels(image, narrative, pageNumber, tokens);
}

export function generateLayout(orderedImages: ScannedImage[], tokens: LayoutTokens): PageLayout[] {
  return orderedImages.map((image, index) => {
    const caption = cleanCaptionFromFilename(image.filename);
    const narrative = buildNarrative(caption, index);
    const template = pickTemplate(image, index);
    return buildPage(image, narrative, index + 1, tokens, template);
  });
}

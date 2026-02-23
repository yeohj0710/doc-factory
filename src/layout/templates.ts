import type { ScannedImage } from "@/src/io/scanImages";
import type { Narrative, PageTemplate } from "@/src/layout/content";
import type { LayoutTokens } from "@/src/layout/tokens";
import {
  PAGE_SIZE_A4_PORTRAIT,
  type Element,
  type ImageElement,
  type PageLayout,
} from "@/src/layout/types";

const PAGE_W = PAGE_SIZE_A4_PORTRAIT.widthMm;
const PAGE_H = PAGE_SIZE_A4_PORTRAIT.heightMm;

type ImageFrame = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fit?: "cover" | "contain";
  anchorX?: number;
  anchorY?: number;
};

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function bulletLines(lines: readonly string[], count = lines.length): string {
  return lines
    .slice(0, count)
    .map((line) => `- ${line}`)
    .join("\n");
}

function imageElement(image: ScannedImage, frame: ImageFrame): ImageElement {
  return {
    type: "image",
    xMm: frame.xMm,
    yMm: frame.yMm,
    wMm: frame.wMm,
    hMm: frame.hMm,
    srcPublicPath: image.publicPath,
    fit: frame.fit ?? "cover",
    intrinsicWidthPx: image.widthPx,
    intrinsicHeightPx: image.heightPx,
    anchorX: frame.anchorX ?? 0.5,
    anchorY: frame.anchorY ?? 0.5,
  };
}

function addFooter(elements: Element[], narrative: Narrative, tokens: LayoutTokens): void {
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

function addChipRow(
  elements: Element[],
  chips: readonly string[],
  xMm: number,
  yMm: number,
  widthMm: number,
  tokens: LayoutTokens,
): void {
  const gap = 4;
  const chipW = (widthMm - gap * (chips.length - 1)) / chips.length;

  chips.forEach((chip, index) => {
    const x = xMm + index * (chipW + gap);
    elements.push(
      {
        type: "rect",
        xMm: x,
        yMm,
        wMm: chipW,
        hMm: 10,
        fill: tokens.colors.highlightSoft,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.25,
      },
      {
        type: "text",
        xMm: x + 1.5,
        yMm: yMm + 2.3,
        wMm: chipW - 3,
        hMm: 5.5,
        text: shortText(chip, 22),
        fontSizePt: tokens.fontScalePt.micro,
        bold: true,
        align: "center",
        color: tokens.colors.accentDeep,
      },
    );
  });
}

function addMetricCards(
  elements: Element[],
  metrics: Narrative["metrics"],
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  direction: "row" | "column",
  tokens: LayoutTokens,
): void {
  const gap = 2.4;
  const cardSize =
    direction === "row"
      ? (widthMm - gap * (metrics.length - 1)) / metrics.length
      : (heightMm - gap * (metrics.length - 1)) / metrics.length;

  metrics.forEach((metric, index) => {
    const x = direction === "row" ? xMm + index * (cardSize + gap) : xMm;
    const y = direction === "row" ? yMm : yMm + index * (cardSize + gap);
    const w = direction === "row" ? cardSize : widthMm;
    const h = direction === "row" ? heightMm : cardSize;
    const label = shortText(metric.label, 20);
    const value = shortText(metric.value, direction === "row" ? 32 : 24);

    elements.push(
      {
        type: "rect",
        xMm: x,
        yMm: y,
        wMm: w,
        hMm: h,
        fill: tokens.colors.page,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
      },
      {
        type: "text",
        xMm: x + 2,
        yMm: y + 2,
        wMm: w - 4,
        hMm: h - 4,
        text: `${label}\n${value}`,
        fontSizePt: tokens.fontScalePt.micro,
        bold: true,
        align: direction === "row" ? "center" : "left",
        color: tokens.colors.text,
      },
    );
  });
}

function buildCinematicHero(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const width = PAGE_W - margin * 2;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 106, fill: tokens.colors.softAccentAlt },
    { type: "rect", xMm: 0, yMm: 0, wMm: 8, hMm: 106, fill: tokens.colors.accent },
    {
      type: "rect",
      xMm: 138,
      yMm: 12,
      wMm: 60,
      hMm: 24,
      fill: tokens.colors.page,
      fillOpacity: 0.6,
      radiusMm: tokens.radiusMm.md,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 12,
      wMm: 124,
      hMm: 8,
      text: narrative.kicker,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.accentDeep,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 23,
      wMm: 132,
      hMm: 24,
      text: shortText(narrative.title, 40),
      fontSizePt: tokens.fontScalePt.title,
      bold: true,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 51,
      wMm: 132,
      hMm: 14,
      text: narrative.subtitle,
      fontSizePt: tokens.fontScalePt.lead,
      color: tokens.colors.mutedText,
    },
  ];

  addChipRow(elements, narrative.chips, margin, 69, 124, tokens);

  elements.push(
    imageElement(image, {
      xMm: margin,
      yMm: 86,
      wMm: width,
      hMm: 124,
      fit: "cover",
      anchorX: 0.52,
      anchorY: 0.47,
    }),
    {
      type: "rect",
      xMm: margin,
      yMm: 177,
      wMm: width,
      hMm: 33,
      fill: tokens.colors.accentDeep,
      fillOpacity: 0.88,
    },
    {
      type: "text",
      xMm: margin + 5,
      yMm: 184,
      wMm: width - 10,
      hMm: 20,
      text: narrative.callout,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.inverseText,
    },
    {
      type: "rect",
      xMm: margin,
      yMm: 214,
      wMm: 122,
      hMm: 56,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 5,
      yMm: 221,
      wMm: 112,
      hMm: 44,
      text: `${narrative.summary}\n${bulletLines(narrative.bullets, 1)}`,
      fontSizePt: tokens.fontScalePt.body,
      color: tokens.colors.text,
    },
    {
      type: "rect",
      xMm: 138,
      yMm: 214,
      wMm: 60,
      hMm: 56,
      fill: tokens.colors.softAccentAlt,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 253,
      wMm: width,
      hMm: 18,
      text: bulletLines(narrative.bullets.slice(1, 4), 3),
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.mutedText,
    },
  );

  addMetricCards(elements, narrative.metrics, 141, 217, 54, 50, "column", tokens);
  addFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildEditorialSpread(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const leftW = 76;
  const rightX = margin + leftW + 6;
  const rightW = PAGE_W - margin - rightX;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    {
      type: "rect",
      xMm: margin,
      yMm: margin,
      wMm: leftW,
      hMm: PAGE_H - margin * 2,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
    },
    {
      type: "rect",
      xMm: margin,
      yMm: margin,
      wMm: 5,
      hMm: PAGE_H - margin * 2,
      fill: tokens.colors.accent,
      radiusMm: tokens.radiusMm.sm,
    },
    {
      type: "text",
      xMm: margin + 7,
      yMm: 18,
      wMm: leftW - 12,
      hMm: 8,
      text: narrative.kicker,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.accentDeep,
    },
    {
      type: "text",
      xMm: margin + 7,
      yMm: 30,
      wMm: leftW - 12,
      hMm: 42,
      text: shortText(narrative.title, 34),
      fontSizePt: tokens.fontScalePt.subtitle,
      bold: true,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: margin + 7,
      yMm: 74,
      wMm: leftW - 12,
      hMm: 20,
      text: narrative.subtitle,
      fontSizePt: tokens.fontScalePt.body,
      color: tokens.colors.mutedText,
    },
    {
      type: "rect",
      xMm: margin + 7,
      yMm: 100,
      wMm: leftW - 14,
      hMm: 49,
      fill: tokens.colors.page,
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 11,
      yMm: 107,
      wMm: leftW - 22,
      hMm: 36,
      text: bulletLines(narrative.bullets, 2),
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
    {
      type: "rect",
      xMm: margin + 7,
      yMm: 155,
      wMm: leftW - 14,
      hMm: 49,
      fill: tokens.colors.page,
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 11,
      yMm: 162,
      wMm: leftW - 22,
      hMm: 36,
      text: bulletLines(narrative.bullets.slice(2), 2),
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
    {
      type: "rect",
      xMm: rightX,
      yMm: margin,
      wMm: rightW,
      hMm: 140,
      fill: tokens.colors.softAccentAlt,
      radiusMm: tokens.radiusMm.md,
    },
    imageElement(image, {
      xMm: rightX + 2,
      yMm: margin + 2,
      wMm: rightW - 4,
      hMm: 136,
      fit: "cover",
      anchorX: 0.62,
      anchorY: 0.48,
    }),
    {
      type: "rect",
      xMm: rightX + 10,
      yMm: 160,
      wMm: rightW - 20,
      hMm: 56,
      fill: tokens.colors.page,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    imageElement(image, {
      xMm: rightX + 12,
      yMm: 162,
      wMm: rightW - 24,
      hMm: 30,
      fit: "cover",
      anchorX: 0.3,
      anchorY: 0.5,
    }),
    {
      type: "rect",
      xMm: rightX,
      yMm: 222,
      wMm: rightW,
      hMm: 48,
      fill: tokens.colors.accentDeep,
      radiusMm: tokens.radiusMm.sm,
    },
    {
      type: "text",
      xMm: rightX + 4,
      yMm: 229,
      wMm: rightW - 8,
      hMm: 36,
      text: `${narrative.summary}\n${narrative.callout}`,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.inverseText,
    },
  ];

  addChipRow(elements, narrative.chips, margin + 7, 211, leftW - 14, tokens);
  addMetricCards(elements, narrative.metrics, rightX, 194, rightW, 24, "row", tokens);
  addFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildMosaicNotes(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const width = PAGE_W - margin * 2;
  const cardW = (width - 8) / 3;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 72, fill: tokens.colors.softAccentAlt },
    {
      type: "text",
      xMm: margin,
      yMm: 12,
      wMm: width,
      hMm: 8,
      text: narrative.kicker,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.accentDeep,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 24,
      wMm: width,
      hMm: 20,
      text: shortText(narrative.title, 48),
      fontSizePt: tokens.fontScalePt.subtitle,
      bold: true,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 48,
      wMm: width,
      hMm: 12,
      text: narrative.subtitle,
      fontSizePt: tokens.fontScalePt.body,
      color: tokens.colors.mutedText,
    },
    imageElement(image, {
      xMm: margin,
      yMm: 78,
      wMm: 118,
      hMm: 70,
      fit: "cover",
      anchorX: 0.45,
      anchorY: 0.45,
    }),
    imageElement(image, {
      xMm: 134,
      yMm: 78,
      wMm: 64,
      hMm: 34,
      fit: "cover",
      anchorX: 0.72,
      anchorY: 0.45,
    }),
    imageElement(image, {
      xMm: 134,
      yMm: 114,
      wMm: 64,
      hMm: 34,
      fit: "cover",
      anchorX: 0.24,
      anchorY: 0.56,
    }),
    imageElement(image, {
      xMm: margin,
      yMm: 152,
      wMm: width,
      hMm: 74,
      fit: "cover",
      anchorX: 0.56,
      anchorY: 0.5,
    }),
    {
      type: "rect",
      xMm: margin,
      yMm: 199,
      wMm: width,
      hMm: 27,
      fill: tokens.colors.accentDeep,
      fillOpacity: 0.88,
    },
    {
      type: "text",
      xMm: margin + 5,
      yMm: 206,
      wMm: width - 10,
      hMm: 14,
      text: narrative.callout,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.inverseText,
    },
  ];

  addChipRow(elements, narrative.chips, margin, 61, width, tokens);

  elements.push(
    {
      type: "rect",
      xMm: margin,
      yMm: 232,
      wMm: cardW,
      hMm: 44,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 3,
      yMm: 238,
      wMm: cardW - 6,
      hMm: 34,
      text: narrative.summary,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
    {
      type: "rect",
      xMm: margin + cardW + 4,
      yMm: 232,
      wMm: cardW,
      hMm: 44,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + cardW + 7,
      yMm: 238,
      wMm: cardW - 6,
      hMm: 34,
      text: bulletLines(narrative.bullets, 2),
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
    {
      type: "rect",
      xMm: margin + (cardW + 4) * 2,
      yMm: 232,
      wMm: cardW,
      hMm: 44,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + (cardW + 4) * 2 + 3,
      yMm: 238,
      wMm: cardW - 6,
      hMm: 34,
      text: `${shortText(narrative.metrics[0].value, 18)}\n${shortText(narrative.metrics[1].value, 18)}\n${shortText(narrative.metrics[2].value, 18)}`,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
  );

  addFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildFocusRail(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    {
      type: "rect",
      xMm: margin,
      yMm: margin,
      wMm: 48,
      hMm: PAGE_H - margin * 2,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
    },
    {
      type: "rect",
      xMm: 162,
      yMm: margin,
      wMm: 36,
      hMm: PAGE_H - margin * 2,
      fill: tokens.colors.softAccentAlt,
      radiusMm: tokens.radiusMm.md,
    },
    {
      type: "rect",
      xMm: 62,
      yMm: 30,
      wMm: 98,
      hMm: 190,
      fill: tokens.colors.softAccentAlt,
      radiusMm: tokens.radiusMm.lg,
    },
    {
      type: "rect",
      xMm: 64,
      yMm: 32,
      wMm: 94,
      hMm: 186,
      fill: tokens.colors.page,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.35,
    },
    imageElement(image, {
      xMm: 66,
      yMm: 34,
      wMm: 90,
      hMm: 182,
      fit: "cover",
      anchorX: 0.45,
      anchorY: 0.5,
    }),
    {
      type: "rect",
      xMm: 66,
      yMm: 186,
      wMm: 90,
      hMm: 30,
      fill: tokens.colors.accentDeep,
      fillOpacity: 0.85,
    },
    {
      type: "text",
      xMm: margin + 4,
      yMm: 18,
      wMm: 40,
      hMm: 8,
      text: narrative.kicker,
      fontSizePt: tokens.fontScalePt.micro,
      bold: true,
      color: tokens.colors.accentDeep,
    },
    {
      type: "text",
      xMm: margin + 4,
      yMm: 30,
      wMm: 40,
      hMm: 46,
      text: shortText(narrative.title, 30),
      fontSizePt: tokens.fontScalePt.lead,
      bold: true,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: margin + 4,
      yMm: 78,
      wMm: 40,
      hMm: 20,
      text: narrative.subtitle,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.mutedText,
    },
    {
      type: "text",
      xMm: margin + 4,
      yMm: 104,
      wMm: 40,
      hMm: 80,
      text: bulletLines(narrative.bullets, 3),
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: 70,
      yMm: 194,
      wMm: 82,
      hMm: 18,
      text: narrative.callout,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.inverseText,
    },
    imageElement(image, {
      xMm: 164,
      yMm: 138,
      wMm: 32,
      hMm: 42,
      fit: "contain",
      anchorX: 0.5,
      anchorY: 0.5,
    }),
    {
      type: "rect",
      xMm: 164,
      yMm: 186,
      wMm: 32,
      hMm: 48,
      fill: tokens.colors.accentDeep,
      radiusMm: tokens.radiusMm.sm,
    },
    {
      type: "text",
      xMm: 166,
      yMm: 192,
      wMm: 28,
      hMm: 36,
      text: shortText(narrative.summary, 86),
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.inverseText,
    },
    {
      type: "rect",
      xMm: margin,
      yMm: 236,
      wMm: 186,
      hMm: 40,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 4,
      yMm: 242,
      wMm: 178,
      hMm: 30,
      text: `${narrative.summary}\n${bulletLines(narrative.bullets.slice(1), 2)}`,
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
  ];

  addChipRow(elements, narrative.chips, margin + 4, 190, 40, tokens);
  addMetricCards(elements, narrative.metrics, 164, 24, 32, 106, "column", tokens);
  addFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

function buildContrastPoster(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const width = PAGE_W - margin * 2;
  const elements: Element[] = [
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H, fill: tokens.colors.page },
    { type: "rect", xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 100, fill: tokens.colors.softAccentAlt },
    { type: "rect", xMm: 0, yMm: 0, wMm: 12, hMm: 100, fill: tokens.colors.highlight },
    {
      type: "text",
      xMm: margin,
      yMm: 12,
      wMm: width - 44,
      hMm: 8,
      text: narrative.kicker,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.accentDeep,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 24,
      wMm: width - 44,
      hMm: 30,
      text: shortText(narrative.title, 36),
      fontSizePt: tokens.fontScalePt.title,
      bold: true,
      color: tokens.colors.text,
    },
    {
      type: "text",
      xMm: margin,
      yMm: 58,
      wMm: width - 44,
      hMm: 14,
      text: narrative.subtitle,
      fontSizePt: tokens.fontScalePt.lead,
      color: tokens.colors.mutedText,
    },
    {
      type: "text",
      xMm: 158,
      yMm: 20,
      wMm: 40,
      hMm: 26,
      text: String(pageNumber).padStart(2, "0"),
      fontSizePt: 46,
      bold: true,
      align: "right",
      color: "#D8DEE7",
    },
    {
      type: "rect",
      xMm: margin,
      yMm: 76,
      wMm: width,
      hMm: 22,
      fill: tokens.colors.accentDeep,
      radiusMm: tokens.radiusMm.sm,
    },
    {
      type: "text",
      xMm: margin + 4,
      yMm: 82,
      wMm: width - 8,
      hMm: 12,
      text: narrative.callout,
      fontSizePt: tokens.fontScalePt.caption,
      bold: true,
      color: tokens.colors.inverseText,
    },
    {
      type: "rect",
      xMm: margin,
      yMm: 106,
      wMm: 90,
      hMm: 136,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
    },
    {
      type: "rect",
      xMm: 108,
      yMm: 106,
      wMm: 90,
      hMm: 136,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.md,
    },
    imageElement(image, {
      xMm: margin + 2,
      yMm: 108,
      wMm: 86,
      hMm: 132,
      fit: "cover",
      anchorX: 0.34,
      anchorY: 0.5,
    }),
    imageElement(image, {
      xMm: 110,
      yMm: 108,
      wMm: 86,
      hMm: 132,
      fit: "cover",
      anchorX: 0.67,
      anchorY: 0.5,
    }),
    {
      type: "line",
      x1Mm: 105,
      y1Mm: 106,
      x2Mm: 105,
      y2Mm: 242,
      stroke: tokens.colors.border,
      widthMm: 0.4,
    },
    {
      type: "rect",
      xMm: margin + 6,
      yMm: 112,
      wMm: 28,
      hMm: 10,
      fill: tokens.colors.accentDeep,
      radiusMm: tokens.radiusMm.sm,
    },
    {
      type: "text",
      xMm: margin + 8,
      yMm: 114.5,
      wMm: 24,
      hMm: 6,
      text: shortText(narrative.panelLabels[0], 14),
      fontSizePt: tokens.fontScalePt.micro,
      bold: true,
      align: "center",
      color: tokens.colors.inverseText,
    },
    {
      type: "rect",
      xMm: 114,
      yMm: 112,
      wMm: 28,
      hMm: 10,
      fill: tokens.colors.accentDeep,
      radiusMm: tokens.radiusMm.sm,
    },
    {
      type: "text",
      xMm: 116,
      yMm: 114.5,
      wMm: 24,
      hMm: 6,
      text: shortText(narrative.panelLabels[1], 14),
      fontSizePt: tokens.fontScalePt.micro,
      bold: true,
      align: "center",
      color: tokens.colors.inverseText,
    },
    {
      type: "rect",
      xMm: margin,
      yMm: 246,
      wMm: 120,
      hMm: 30,
      fill: tokens.colors.softAccent,
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
    {
      type: "text",
      xMm: margin + 3,
      yMm: 252,
      wMm: 112,
      hMm: 20,
      text: bulletLines(narrative.bullets, 2),
      fontSizePt: tokens.fontScalePt.micro,
      color: tokens.colors.text,
    },
    {
      type: "rect",
      xMm: 136,
      yMm: 246,
      wMm: 62,
      hMm: 30,
      fill: tokens.colors.softAccentAlt,
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
    },
  ];

  addMetricCards(elements, narrative.metrics, 139, 249, 56, 24, "row", tokens);
  addChipRow(elements, narrative.chips, margin, 96, width, tokens);
  addFooter(elements, narrative, tokens);
  return { pageNumber, elements };
}

export function buildTemplatePage(
  image: ScannedImage,
  narrative: Narrative,
  pageNumber: number,
  tokens: LayoutTokens,
  template: PageTemplate,
): PageLayout {
  if (template === "cinematic-hero") {
    return buildCinematicHero(image, narrative, pageNumber, tokens);
  }
  if (template === "editorial-spread") {
    return buildEditorialSpread(image, narrative, pageNumber, tokens);
  }
  if (template === "mosaic-notes") {
    return buildMosaicNotes(image, narrative, pageNumber, tokens);
  }
  if (template === "focus-rail") {
    return buildFocusRail(image, narrative, pageNumber, tokens);
  }
  return buildContrastPoster(image, narrative, pageNumber, tokens);
}

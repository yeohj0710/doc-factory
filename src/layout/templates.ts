import type { ScannedImage } from "@/src/io/scanImages";
import type { PageBrief, PageTemplateId } from "@/src/layout/content";
import type { LayoutTokens } from "@/src/layout/tokens";
import {
  PAGE_SIZE_A4_PORTRAIT,
  type Element,
  type ImageElement,
  type PageLayout,
  type RectElement,
  type TextElement,
} from "@/src/layout/types";

const PAGE_W = PAGE_SIZE_A4_PORTRAIT.widthMm;
const PAGE_H = PAGE_SIZE_A4_PORTRAIT.heightMm;

type Frame = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function bulletLines(lines: readonly string[]): string {
  return lines.map((line) => `• ${line}`).join("\n");
}

function rect(
  frame: Frame,
  fill: string,
  options?: Partial<Omit<RectElement, "type" | "xMm" | "yMm" | "wMm" | "hMm" | "fill">>,
): RectElement {
  return {
    type: "rect",
    ...frame,
    fill,
    ...options,
  };
}

function text(
  frame: Frame,
  value: string,
  fontSizePt: number,
  options?: Partial<Omit<TextElement, "type" | "xMm" | "yMm" | "wMm" | "hMm" | "text" | "fontSizePt">>,
): TextElement {
  return {
    type: "text",
    ...frame,
    text: value,
    fontSizePt,
    lineHeight: 1.25,
    ...options,
  };
}

function image(
  source: ScannedImage,
  frame: Frame,
  options?: Partial<Omit<ImageElement, "type" | "xMm" | "yMm" | "wMm" | "hMm" | "srcPublicPath">>,
): ImageElement {
  return {
    type: "image",
    ...frame,
    srcPublicPath: source.publicPath,
    fit: "cover",
    intrinsicWidthPx: source.widthPx,
    intrinsicHeightPx: source.heightPx,
    anchorX: 0.5,
    anchorY: 0.5,
    ...options,
  };
}

function addFooter(elements: Element[], brief: PageBrief, tokens: LayoutTokens): void {
  const margin = tokens.spacingMm.pageMargin;
  const footerHeight = tokens.spacingMm.footerHeight;
  const footerY = PAGE_H - margin - footerHeight;

  elements.push(
    {
      type: "line",
      x1Mm: margin,
      y1Mm: footerY + 1.2,
      x2Mm: PAGE_W - margin,
      y2Mm: footerY + 1.2,
      stroke: tokens.colors.border,
      widthMm: 0.3,
      id: "footer-divider",
      role: "footer",
      collisionGroup: "footer",
      isCollisionProtected: true,
    },
    text(
      {
        xMm: margin,
        yMm: footerY + 3.2,
        wMm: PAGE_W - margin * 2,
        hMm: footerHeight - 3.2,
      },
      brief.narrative.footer,
      tokens.fontScalePt.micro,
      {
        color: tokens.colors.mutedText,
        id: "footer-text",
        role: "footer",
        collisionGroup: "footer",
        isCollisionProtected: true,
      },
    ),
  );
}

function addChipRow(
  elements: Element[],
  chips: readonly string[],
  frame: Frame,
  tokens: LayoutTokens,
  groupPrefix: string,
): void {
  const gap = 3;
  const chipCount = Math.max(chips.length, 1);
  const chipWidth = (frame.wMm - gap * (chipCount - 1)) / chipCount;

  chips.forEach((chip, index) => {
    const x = frame.xMm + index * (chipWidth + gap);
    const chipGroup = `${groupPrefix}-chip-${index + 1}`;
    elements.push(
      rect(
        { xMm: x, yMm: frame.yMm, wMm: chipWidth, hMm: frame.hMm },
        tokens.colors.highlightSoft,
        {
          radiusMm: tokens.radiusMm.sm,
          stroke: tokens.colors.border,
          strokeWidthMm: 0.25,
          id: `${chipGroup}-box`,
          role: "chip",
          collisionGroup: chipGroup,
          isCollisionProtected: true,
        },
      ),
      text(
        {
          xMm: x + 1.5,
          yMm: frame.yMm + 2.1,
          wMm: chipWidth - 3,
          hMm: frame.hMm - 3.2,
        },
        chip,
        tokens.fontScalePt.micro,
        {
          bold: true,
          align: "center",
          color: tokens.colors.accentDeep,
          id: `${chipGroup}-text`,
          role: "chip",
          collisionGroup: chipGroup,
          isCollisionProtected: true,
        },
      ),
    );
  });
}

function addMetricCardsColumn(
  elements: Element[],
  metrics: PageBrief["narrative"]["metrics"],
  frame: Frame,
  tokens: LayoutTokens,
  groupPrefix: string,
): void {
  const gap = 3;
  const cardHeight = (frame.hMm - gap * (metrics.length - 1)) / metrics.length;

  metrics.forEach((metric, index) => {
    const y = frame.yMm + index * (cardHeight + gap);
    const group = `${groupPrefix}-metric-${index + 1}`;

    elements.push(
      rect(
        { xMm: frame.xMm, yMm: y, wMm: frame.wMm, hMm: cardHeight },
        tokens.colors.page,
        {
          radiusMm: tokens.radiusMm.sm,
          stroke: tokens.colors.border,
          strokeWidthMm: 0.25,
          id: `${group}-box`,
          role: "metric",
          collisionGroup: group,
          isCollisionProtected: true,
        },
      ),
      text(
        {
          xMm: frame.xMm + 2,
          yMm: y + 2,
          wMm: frame.wMm - 4,
          hMm: cardHeight - 3,
        },
        `${metric.label}\n${metric.value}`,
        tokens.fontScalePt.micro,
        {
          bold: true,
          color: tokens.colors.text,
          id: `${group}-text`,
          role: "metric",
          collisionGroup: group,
          isCollisionProtected: true,
        },
      ),
    );
  });
}

function addMetricCardsRow(
  elements: Element[],
  metrics: PageBrief["narrative"]["metrics"],
  frame: Frame,
  tokens: LayoutTokens,
  groupPrefix: string,
): void {
  const gap = 2;
  const cardWidth = (frame.wMm - gap * (metrics.length - 1)) / metrics.length;

  metrics.forEach((metric, index) => {
    const x = frame.xMm + index * (cardWidth + gap);
    const group = `${groupPrefix}-metric-${index + 1}`;

    elements.push(
      rect(
        { xMm: x, yMm: frame.yMm, wMm: cardWidth, hMm: frame.hMm },
        tokens.colors.page,
        {
          radiusMm: tokens.radiusMm.sm,
          stroke: tokens.colors.border,
          strokeWidthMm: 0.25,
          id: `${group}-box`,
          role: "metric",
          collisionGroup: group,
          isCollisionProtected: true,
        },
      ),
      text(
        {
          xMm: x + 1.7,
          yMm: frame.yMm + 1.6,
          wMm: cardWidth - 3.4,
          hMm: frame.hMm - 3,
        },
        `${metric.label}\n${metric.value}`,
        tokens.fontScalePt.micro,
        {
          align: "center",
          bold: true,
          color: tokens.colors.text,
          id: `${group}-text`,
          role: "metric",
          collisionGroup: group,
          isCollisionProtected: true,
        },
      ),
    );
  });
}

function buildFullBleedCaption(
  imageSource: ScannedImage,
  brief: PageBrief,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = Math.max(tokens.spacingMm.gutter, 4);
  const footerHeight = tokens.spacingMm.footerHeight;
  const contentTop = margin;
  const footerY = PAGE_H - margin - footerHeight;
  const contentBottom = footerY - gutter;
  const contentW = PAGE_W - margin * 2;
  const contentH = contentBottom - contentTop;
  const headerH = 40;
  const chipH = 10;
  const calloutH = 20;
  const minDetailH = 38;
  const heroH = clamp(contentH - (headerH + chipH + calloutH + minDetailH + gutter * 4), 92, 122);
  const detailH = contentH - (headerH + chipH + heroH + calloutH + gutter * 4);
  const headerY = contentTop;
  const chipsY = headerY + headerH + gutter;
  const heroY = chipsY + chipH + gutter;
  const calloutY = heroY + heroH + gutter;
  const detailY = calloutY + calloutH + gutter;
  const detailLeftW = 122;
  const detailRightW = contentW - detailLeftW - gutter;

  const elements: Element[] = [
    rect({ xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H }, tokens.colors.page, {
      id: "background",
      role: "background",
    }),
    rect(
      { xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 68 },
      tokens.colors.softAccentAlt,
      {
        id: "header-band",
        role: "decorative",
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 2, wMm: contentW, hMm: 7 },
      brief.narrative.kicker,
      tokens.fontScalePt.caption,
      {
        bold: true,
        color: tokens.colors.accentDeep,
        id: "hero-kicker",
        role: "text",
        collisionGroup: "hero-header",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 11, wMm: contentW, hMm: 14 },
      brief.narrative.title,
      tokens.fontScalePt.title,
      {
        bold: true,
        color: tokens.colors.text,
        id: "hero-title",
        role: "text",
        collisionGroup: "hero-header",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 27, wMm: contentW, hMm: 11 },
      brief.narrative.subtitle,
      tokens.fontScalePt.lead,
      {
        color: tokens.colors.mutedText,
        id: "hero-subtitle",
        role: "text",
        collisionGroup: "hero-header",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: heroY, wMm: contentW, hMm: heroH },
      tokens.colors.softAccent,
      {
        radiusMm: tokens.radiusMm.md,
        id: "hero-media-frame",
        role: "media",
        collisionGroup: "hero-media",
        isCollisionProtected: true,
      },
    ),
    image(
      imageSource,
      { xMm: margin + 1.4, yMm: heroY + 1.4, wMm: contentW - 2.8, hMm: heroH - 2.8 },
      {
        fit: "cover",
        anchorX: 0.52,
        anchorY: 0.48,
        id: "hero-image",
        role: "media",
        collisionGroup: "hero-media",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: calloutY, wMm: contentW, hMm: calloutH },
      tokens.colors.accentDeep,
      {
        radiusMm: tokens.radiusMm.sm,
        id: "hero-callout-bg",
        role: "text",
        collisionGroup: "hero-callout",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin + 3.5, yMm: calloutY + 4.1, wMm: contentW - 7, hMm: calloutH - 6.2 },
      brief.narrative.callout,
      tokens.fontScalePt.caption,
      {
        bold: true,
        color: tokens.colors.inverseText,
        id: "hero-callout-text",
        role: "text",
        collisionGroup: "hero-callout",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: detailY, wMm: detailLeftW, hMm: detailH },
      tokens.colors.softAccent,
      {
        radiusMm: tokens.radiusMm.md,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
        id: "hero-detail-bg",
        role: "text",
        collisionGroup: "hero-detail",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin + 3.2, yMm: detailY + 3.2, wMm: detailLeftW - 6.4, hMm: detailH - 6.4 },
      `${brief.narrative.body}\n\n${bulletLines(brief.narrative.bullets)}`,
      tokens.fontScalePt.micro,
      {
        color: tokens.colors.text,
        id: "hero-detail-text",
        role: "text",
        collisionGroup: "hero-detail",
        isCollisionProtected: true,
      },
    ),
  ];

  addChipRow(
    elements,
    brief.narrative.chips,
    { xMm: margin, yMm: chipsY, wMm: contentW, hMm: chipH },
    tokens,
    "hero",
  );
  addMetricCardsColumn(
    elements,
    brief.narrative.metrics,
    { xMm: margin + detailLeftW + gutter, yMm: detailY, wMm: detailRightW, hMm: detailH },
    tokens,
    "hero",
  );
  addFooter(elements, brief, tokens);

  return {
    pageNumber,
    elements,
  };
}

function buildTitleImageSafe(
  imageSource: ScannedImage,
  brief: PageBrief,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = Math.max(tokens.spacingMm.gutter, 4);
  const footerHeight = tokens.spacingMm.footerHeight;
  const contentTop = margin;
  const footerY = PAGE_H - margin - footerHeight;
  const contentBottom = footerY - gutter;
  const contentW = PAGE_W - margin * 2;
  const contentH = contentBottom - contentTop;
  const headerH = 44;
  const minBodyH = 48;
  const minSupportH = 30;
  const heroH = clamp(contentH - (headerH + minBodyH + minSupportH + gutter * 3), 96, 126);
  const bodyH = minBodyH;
  const supportH = contentH - (headerH + heroH + bodyH + gutter * 3);
  const headerY = contentTop;
  const heroY = headerY + headerH + gutter;
  const bodyY = heroY + heroH + gutter;
  const supportY = bodyY + bodyH + gutter;
  const supportLeftW = 78;
  const supportRightW = contentW - supportLeftW - gutter;

  const elements: Element[] = [
    rect({ xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H }, tokens.colors.page, {
      id: "background",
      role: "background",
    }),
    rect(
      { xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 70 },
      tokens.colors.softAccentAlt,
      {
        id: "header-band",
        role: "decorative",
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 2, wMm: contentW, hMm: 7 },
      brief.narrative.kicker,
      tokens.fontScalePt.caption,
      {
        bold: true,
        color: tokens.colors.accentDeep,
        id: "safe-kicker",
        role: "text",
        collisionGroup: "safe-header",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 11, wMm: contentW, hMm: 16 },
      brief.narrative.title,
      tokens.fontScalePt.title,
      {
        bold: true,
        color: tokens.colors.text,
        id: "safe-title",
        role: "text",
        collisionGroup: "safe-header",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 29, wMm: contentW, hMm: 11 },
      brief.narrative.subtitle,
      tokens.fontScalePt.lead,
      {
        color: tokens.colors.mutedText,
        id: "safe-subtitle",
        role: "text",
        collisionGroup: "safe-header",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: heroY, wMm: contentW, hMm: heroH },
      tokens.colors.softAccent,
      {
        radiusMm: tokens.radiusMm.md,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
        id: "safe-media-frame",
        role: "media",
        collisionGroup: "safe-media",
        isCollisionProtected: true,
      },
    ),
    image(
      imageSource,
      { xMm: margin + 1.2, yMm: heroY + 1.2, wMm: contentW - 2.4, hMm: heroH - 2.4 },
      {
        fit: "cover",
        anchorX: 0.5,
        anchorY: 0.5,
        id: "safe-image",
        role: "media",
        collisionGroup: "safe-media",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: bodyY, wMm: contentW, hMm: bodyH },
      tokens.colors.softAccent,
      {
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
        id: "safe-body-bg",
        role: "text",
        collisionGroup: "safe-body",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin + 3.2, yMm: bodyY + 3.2, wMm: contentW - 6.4, hMm: 8 },
      brief.narrative.callout,
      tokens.fontScalePt.caption,
      {
        bold: true,
        color: tokens.colors.accentDeep,
        id: "safe-callout",
        role: "text",
        collisionGroup: "safe-body",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin + 3.2, yMm: bodyY + 13.8, wMm: contentW - 6.4, hMm: bodyH - 17 },
      `${brief.narrative.body}\n${bulletLines(brief.narrative.bullets)}`,
      tokens.fontScalePt.micro,
      {
        color: tokens.colors.text,
        id: "safe-body-text",
        role: "text",
        collisionGroup: "safe-body",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: supportY, wMm: supportLeftW, hMm: supportH },
      tokens.colors.page,
      {
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.25,
        id: "safe-chip-panel",
        role: "chip",
        collisionGroup: "safe-support-left",
        isCollisionProtected: true,
      },
    ),
  ];

  addChipRow(
    elements,
    brief.narrative.chips,
    { xMm: margin + 2, yMm: supportY + 2.4, wMm: supportLeftW - 4, hMm: supportH - 4.8 },
    tokens,
    "safe",
  );
  addMetricCardsRow(
    elements,
    brief.narrative.metrics,
    { xMm: margin + supportLeftW + gutter, yMm: supportY, wMm: supportRightW, hMm: supportH },
    tokens,
    "safe",
  );
  addFooter(elements, brief, tokens);

  return {
    pageNumber,
    elements,
  };
}

function buildTwoColumnImageText(
  imageSource: ScannedImage,
  brief: PageBrief,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = Math.max(tokens.spacingMm.gutter, 4);
  const footerHeight = tokens.spacingMm.footerHeight;
  const contentTop = margin;
  const footerY = PAGE_H - margin - footerHeight;
  const contentBottom = footerY - gutter;
  const contentW = PAGE_W - margin * 2;
  const contentH = contentBottom - contentTop;
  const headerH = 36;
  const supportH = 36;
  const mainH = contentH - headerH - supportH - gutter * 2;
  const headerY = contentTop;
  const mainY = headerY + headerH + gutter;
  const supportY = mainY + mainH + gutter;
  const leftW = 98;
  const rightW = contentW - leftW - gutter;
  const rightSubtitleH = 18;
  const rightChipH = 10;
  const rightBodyH = 52;
  const rightBulletH = mainH - (rightSubtitleH + rightChipH + rightBodyH + gutter * 3);

  const elements: Element[] = [
    rect({ xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H }, tokens.colors.page, {
      id: "background",
      role: "background",
    }),
    rect(
      { xMm: 0, yMm: 0, wMm: PAGE_W, hMm: 58 },
      tokens.colors.softAccentAlt,
      {
        id: "header-band",
        role: "decorative",
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 1.5, wMm: contentW, hMm: 6.5 },
      brief.narrative.kicker,
      tokens.fontScalePt.caption,
      {
        bold: true,
        color: tokens.colors.accentDeep,
        id: "col-kicker",
        role: "text",
        collisionGroup: "col-header",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin, yMm: headerY + 10, wMm: contentW, hMm: 14 },
      brief.narrative.title,
      tokens.fontScalePt.subtitle,
      {
        bold: true,
        color: tokens.colors.text,
        id: "col-title",
        role: "text",
        collisionGroup: "col-header",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: mainY, wMm: leftW, hMm: mainH },
      tokens.colors.softAccent,
      {
        radiusMm: tokens.radiusMm.md,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.3,
        id: "col-image-frame",
        role: "media",
        collisionGroup: "col-media",
        isCollisionProtected: true,
      },
    ),
    image(
      imageSource,
      { xMm: margin + 1.2, yMm: mainY + 1.2, wMm: leftW - 2.4, hMm: mainH - 2.4 },
      {
        fit: "cover",
        anchorX: 0.5,
        anchorY: 0.48,
        id: "col-image",
        role: "media",
        collisionGroup: "col-media",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin + leftW + gutter, yMm: mainY + 1.2, wMm: rightW, hMm: rightSubtitleH },
      brief.narrative.subtitle,
      tokens.fontScalePt.body,
      {
        color: tokens.colors.mutedText,
        id: "col-subtitle",
        role: "text",
        collisionGroup: "col-right",
        isCollisionProtected: true,
      },
    ),
    rect(
      {
        xMm: margin + leftW + gutter,
        yMm: mainY + rightSubtitleH + gutter * 2 + rightChipH,
        wMm: rightW,
        hMm: rightBodyH,
      },
      tokens.colors.softAccent,
      {
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.25,
        id: "col-body-bg",
        role: "text",
        collisionGroup: "col-right",
        isCollisionProtected: true,
      },
    ),
    text(
      {
        xMm: margin + leftW + gutter + 2.8,
        yMm: mainY + rightSubtitleH + gutter * 2 + rightChipH + 2.8,
        wMm: rightW - 5.6,
        hMm: rightBodyH - 5.6,
      },
      brief.narrative.body,
      tokens.fontScalePt.micro,
      {
        color: tokens.colors.text,
        id: "col-body-text",
        role: "text",
        collisionGroup: "col-right",
        isCollisionProtected: true,
      },
    ),
    rect(
      {
        xMm: margin + leftW + gutter,
        yMm: mainY + rightSubtitleH + rightChipH + rightBodyH + gutter * 3,
        wMm: rightW,
        hMm: rightBulletH,
      },
      tokens.colors.page,
      {
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.25,
        id: "col-bullet-bg",
        role: "text",
        collisionGroup: "col-right",
        isCollisionProtected: true,
      },
    ),
    text(
      {
        xMm: margin + leftW + gutter + 2.8,
        yMm: mainY + rightSubtitleH + rightChipH + rightBodyH + gutter * 3 + 2.8,
        wMm: rightW - 5.6,
        hMm: rightBulletH - 5.6,
      },
      `${bulletLines(brief.narrative.bullets)}\n\n${brief.narrative.callout}`,
      tokens.fontScalePt.micro,
      {
        color: tokens.colors.text,
        id: "col-bullet-text",
        role: "text",
        collisionGroup: "col-right",
        isCollisionProtected: true,
      },
    ),
    rect(
      { xMm: margin, yMm: supportY, wMm: leftW, hMm: supportH },
      tokens.colors.accentDeep,
      {
        radiusMm: tokens.radiusMm.sm,
        id: "col-support-callout-bg",
        role: "text",
        collisionGroup: "col-support-left",
        isCollisionProtected: true,
      },
    ),
    text(
      { xMm: margin + 2.8, yMm: supportY + 3.2, wMm: leftW - 5.6, hMm: supportH - 5.8 },
      brief.narrative.callout,
      tokens.fontScalePt.micro,
      {
        color: tokens.colors.inverseText,
        bold: true,
        id: "col-support-callout-text",
        role: "text",
        collisionGroup: "col-support-left",
        isCollisionProtected: true,
      },
    ),
  ];

  addChipRow(
    elements,
    brief.narrative.chips,
    {
      xMm: margin + leftW + gutter,
      yMm: mainY + rightSubtitleH + gutter,
      wMm: rightW,
      hMm: rightChipH,
    },
    tokens,
    "col",
  );
  addMetricCardsRow(
    elements,
    brief.narrative.metrics,
    { xMm: margin + leftW + gutter, yMm: supportY, wMm: rightW, hMm: supportH },
    tokens,
    "col",
  );
  addFooter(elements, brief, tokens);

  return {
    pageNumber,
    elements,
  };
}

export function buildTemplatePage(
  imageSource: ScannedImage,
  brief: PageBrief,
  pageNumber: number,
  tokens: LayoutTokens,
  templateId: PageTemplateId,
): PageLayout {
  if (templateId === "full-bleed-caption") {
    return buildFullBleedCaption(imageSource, brief, pageNumber, tokens);
  }
  if (templateId === "title-image-safe") {
    return buildTitleImageSafe(imageSource, brief, pageNumber, tokens);
  }
  return buildTwoColumnImageText(imageSource, brief, pageNumber, tokens);
}

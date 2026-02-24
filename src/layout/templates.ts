import type { ScannedImage } from "@/src/io/scanImages";
import type { PageBrief } from "@/src/layout/content";
import type { LayoutTokens } from "@/src/layout/tokens";
import type { TemplateId } from "@/src/layout/templateCatalog";
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

type TemplatePreset = {
  titleFrame: Frame;
  subtitleFrame: Frame;
  mediaFrame?: Frame;
  bodyFrame: Frame;
  bulletsFrame?: Frame;
  calloutFrame?: Frame;
  chipsFrame?: Frame;
  metricsFrame?: Frame;
  flowFrame?: Frame;
  bodyCompact?: boolean;
};

function rect(
  frame: Frame,
  fill: string,
  options?: Partial<Omit<RectElement, "type" | "xMm" | "yMm" | "wMm" | "hMm" | "fill">>,
): RectElement {
  return { type: "rect", ...frame, fill, ...options };
}

function text(
  frame: Frame,
  value: string,
  fontSizePt: number,
  options?: Partial<Omit<TextElement, "type" | "xMm" | "yMm" | "wMm" | "hMm" | "text" | "fontSizePt">>,
): TextElement {
  return { type: "text", ...frame, text: value, fontSizePt, lineHeight: 1.25, ...options };
}

function image(
  source: ScannedImage,
  frame: Frame,
  fit: ImageElement["fit"],
  options?: Partial<Omit<ImageElement, "type" | "xMm" | "yMm" | "wMm" | "hMm" | "srcPublicPath" | "fit">>,
): ImageElement {
  return {
    type: "image",
    ...frame,
    srcPublicPath: source.publicPath,
    fit,
    intrinsicWidthPx: source.widthPx,
    intrinsicHeightPx: source.heightPx,
    anchorX: 0.5,
    anchorY: 0.5,
    ...options,
  };
}

function bulletLines(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

function pushPanel(
  elements: Element[],
  frame: Frame,
  content: string,
  tokens: LayoutTokens,
  group: string,
  fill?: string,
  color?: string,
): void {
  elements.push(
    rect(frame, fill ?? tokens.colors.softAccent, {
      radiusMm: tokens.radiusMm.sm,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.25,
      id: `${group}-bg`,
      role: "text",
      collisionGroup: group,
      isCollisionProtected: true,
    }),
    text(
      {
        xMm: frame.xMm + 2.8,
        yMm: frame.yMm + 2.8,
        wMm: frame.wMm - 5.6,
        hMm: frame.hMm - 5.2,
      },
      content,
      tokens.fontScalePt.micro,
      {
        color: color ?? tokens.colors.text,
        id: `${group}-text`,
        role: "text",
        collisionGroup: group,
        isCollisionProtected: true,
      },
    ),
  );
}

function pushMedia(
  elements: Element[],
  sourceImage: ScannedImage | null,
  frame: Frame,
  tokens: LayoutTokens,
  brief: PageBrief,
  group: string,
): void {
  elements.push(
    rect(frame, tokens.colors.softAccent, {
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: 0.3,
      id: `${group}-frame`,
      role: "media",
      collisionGroup: group,
      isCollisionProtected: true,
    }),
  );

  if (!sourceImage) {
    elements.push(
      text(
        { xMm: frame.xMm + 3, yMm: frame.yMm + frame.hMm / 2 - 4, wMm: frame.wMm - 6, hMm: 10 },
        "No image asset",
        tokens.fontScalePt.body,
        {
          align: "center",
          color: tokens.colors.mutedText,
          id: `${group}-placeholder`,
          role: "media",
          collisionGroup: group,
          isCollisionProtected: true,
        },
      ),
    );
    return;
  }

  elements.push(
    image(
      sourceImage,
      {
        xMm: frame.xMm + 1.2,
        yMm: frame.yMm + 1.2,
        wMm: frame.wMm - 2.4,
        hMm: frame.hMm - 2.4,
      },
      brief.imageFit,
      {
        id: `${group}-image`,
        role: "media",
        collisionGroup: group,
        isCollisionProtected: true,
      },
    ),
  );
}

function pushChips(elements: Element[], frame: Frame, chips: readonly string[], tokens: LayoutTokens): void {
  const values = chips.slice(0, 3);
  if (values.length === 0) {
    return;
  }
  const gap = 3;
  const chipW = (frame.wMm - gap * (values.length - 1)) / values.length;
  values.forEach((chip, index) => {
    const x = frame.xMm + index * (chipW + gap);
    const group = `chip-${index + 1}`;
    elements.push(
      rect({ xMm: x, yMm: frame.yMm, wMm: chipW, hMm: frame.hMm }, tokens.colors.highlightSoft, {
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.25,
        id: `${group}-bg`,
        role: "chip",
        collisionGroup: group,
        isCollisionProtected: true,
      }),
      text({ xMm: x + 1.4, yMm: frame.yMm + 1.8, wMm: chipW - 2.8, hMm: frame.hMm - 2.8 }, chip, tokens.fontScalePt.micro, {
        align: "center",
        bold: true,
        color: tokens.colors.accentDeep,
        id: `${group}-text`,
        role: "chip",
        collisionGroup: group,
        isCollisionProtected: true,
      }),
    );
  });
}

function pushMetrics(
  elements: Element[],
  frame: Frame,
  metrics: readonly { label: string; value: string }[],
  tokens: LayoutTokens,
): void {
  const values = metrics.slice(0, 3);
  if (values.length === 0) {
    return;
  }
  const gap = 3;
  const cardW = (frame.wMm - gap * (values.length - 1)) / values.length;
  values.forEach((metric, index) => {
    const x = frame.xMm + index * (cardW + gap);
    const group = `metric-${index + 1}`;
    elements.push(
      rect({ xMm: x, yMm: frame.yMm, wMm: cardW, hMm: frame.hMm }, tokens.colors.page, {
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.25,
        id: `${group}-bg`,
        role: "metric",
        collisionGroup: group,
        isCollisionProtected: true,
      }),
      text(
        { xMm: x + 1.4, yMm: frame.yMm + 1.8, wMm: cardW - 2.8, hMm: frame.hMm - 3 },
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

function addFooter(elements: Element[], brief: PageBrief, tokens: LayoutTokens): void {
  const margin = tokens.spacingMm.pageMargin;
  const footerHeight = tokens.spacingMm.footerHeight;
  const footerY = PAGE_H - margin - footerHeight;
  elements.push(
    {
      type: "line",
      x1Mm: margin,
      y1Mm: footerY + 1,
      x2Mm: PAGE_W - margin,
      y2Mm: footerY + 1,
      stroke: tokens.colors.border,
      widthMm: 0.3,
      id: "footer-divider",
      role: "footer",
      collisionGroup: "footer",
      isCollisionProtected: true,
    },
    text(
      { xMm: margin, yMm: footerY + 2.8, wMm: PAGE_W - margin * 2, hMm: footerHeight - 3 },
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

function buildPreset(
  templateId: TemplateId,
  margin: number,
  contentW: number,
  contentBottom: number,
): TemplatePreset {
  if (templateId === "COVER_HERO") {
    return {
      titleFrame: { xMm: margin, yMm: 25, wMm: contentW, hMm: 18 },
      subtitleFrame: { xMm: margin, yMm: 45, wMm: contentW, hMm: 10 },
      mediaFrame: { xMm: margin, yMm: 69, wMm: contentW, hMm: 118 },
      calloutFrame: { xMm: margin, yMm: 193, wMm: contentW, hMm: 17 },
      bodyFrame: { xMm: margin, yMm: 216, wMm: 124, hMm: contentBottom - 216 },
      metricsFrame: { xMm: margin + 130, yMm: 216, wMm: contentW - 130, hMm: contentBottom - 216 },
      chipsFrame: { xMm: margin, yMm: 57, wMm: contentW, hMm: 8 },
    };
  }

  if (templateId === "AGENDA_EDITORIAL") {
    return {
      titleFrame: { xMm: margin, yMm: 29, wMm: contentW, hMm: 14 },
      subtitleFrame: { xMm: margin, yMm: 45, wMm: contentW, hMm: 9 },
      bodyFrame: { xMm: margin, yMm: 64, wMm: contentW, hMm: 124 },
      calloutFrame: { xMm: margin, yMm: 194, wMm: contentW, hMm: contentBottom - 194 },
    };
  }

  if (templateId === "TITLE_MEDIA_SAFE") {
    return {
      titleFrame: { xMm: margin, yMm: 25, wMm: contentW, hMm: 14 },
      subtitleFrame: { xMm: margin, yMm: 41, wMm: contentW, hMm: 9 },
      mediaFrame: { xMm: margin, yMm: 56, wMm: contentW, hMm: 110 },
      bodyFrame: { xMm: margin, yMm: 172, wMm: contentW, hMm: 58 },
      chipsFrame: { xMm: margin, yMm: 236, wMm: contentW, hMm: 9 },
      metricsFrame: { xMm: margin, yMm: 248, wMm: contentW, hMm: contentBottom - 248 },
    };
  }

  if (templateId === "TWO_COLUMN_MEDIA_TEXT") {
    return {
      titleFrame: { xMm: margin, yMm: 24, wMm: contentW, hMm: 14 },
      subtitleFrame: { xMm: margin + 98, yMm: 48, wMm: contentW - 98, hMm: 14 },
      mediaFrame: { xMm: margin, yMm: 46, wMm: 92, hMm: contentBottom - 46 },
      bodyFrame: { xMm: margin + 98, yMm: 66, wMm: contentW - 98, hMm: 74 },
      bulletsFrame: { xMm: margin + 98, yMm: 146, wMm: contentW - 98, hMm: 70 },
      calloutFrame: { xMm: margin + 98, yMm: 222, wMm: contentW - 98, hMm: contentBottom - 222 },
      bodyCompact: true,
    };
  }

  if (templateId === "PROCESS_FLOW") {
    return {
      titleFrame: { xMm: margin, yMm: 27, wMm: contentW, hMm: 13 },
      subtitleFrame: { xMm: margin, yMm: 41, wMm: contentW, hMm: 9 },
      flowFrame: { xMm: margin, yMm: 56, wMm: contentW, hMm: 68 },
      bodyFrame: { xMm: margin, yMm: 130, wMm: contentW, hMm: 58 },
      mediaFrame: { xMm: margin, yMm: 194, wMm: 88, hMm: contentBottom - 194 },
      metricsFrame: { xMm: margin + 94, yMm: 194, wMm: contentW - 94, hMm: contentBottom - 194 },
      bodyCompact: true,
    };
  }

  if (templateId === "METRICS_PROOF") {
    return {
      titleFrame: { xMm: margin, yMm: 26, wMm: contentW, hMm: 13 },
      subtitleFrame: { xMm: margin, yMm: 40, wMm: contentW, hMm: 9 },
      metricsFrame: { xMm: margin, yMm: 56, wMm: contentW, hMm: 44 },
      calloutFrame: { xMm: margin, yMm: 106, wMm: contentW, hMm: 16 },
      bodyFrame: { xMm: margin, yMm: 128, wMm: contentW, hMm: 62 },
      mediaFrame: { xMm: margin, yMm: 196, wMm: 102, hMm: contentBottom - 196 },
      bulletsFrame: { xMm: margin + 108, yMm: 196, wMm: contentW - 108, hMm: contentBottom - 196 },
      bodyCompact: true,
    };
  }

  return {
    titleFrame: { xMm: margin, yMm: 29, wMm: contentW, hMm: 16 },
    subtitleFrame: { xMm: margin, yMm: 47, wMm: contentW, hMm: 10 },
    bodyFrame: { xMm: margin, yMm: 62, wMm: contentW, hMm: 98 },
    bulletsFrame: { xMm: margin, yMm: 166, wMm: contentW, hMm: 42 },
    calloutFrame: { xMm: margin, yMm: 214, wMm: contentW, hMm: contentBottom - 214 },
  };
}

function pushFlowCards(elements: Element[], frame: Frame, tokens: LayoutTokens, bullets: readonly string[]): void {
  const stepCount = Math.min(Math.max(bullets.length, 3), 5);
  const gap = 3;
  const cardW = (frame.wMm - gap * (stepCount - 1)) / stepCount;
  for (let i = 0; i < stepCount; i += 1) {
    const x = frame.xMm + i * (cardW + gap);
    const group = `flow-${i + 1}`;
    elements.push(
      rect({ xMm: x, yMm: frame.yMm, wMm: cardW, hMm: frame.hMm }, tokens.colors.softAccent, {
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: 0.25,
        id: `${group}-bg`,
        role: "text",
        collisionGroup: group,
        isCollisionProtected: true,
      }),
      text({ xMm: x + 1.6, yMm: frame.yMm + 2, wMm: cardW - 3.2, hMm: frame.hMm - 3.5 }, `${i + 1}단계\n${bullets[i] ?? "운영 단계"}`, tokens.fontScalePt.micro, {
        align: "center",
        bold: true,
        color: tokens.colors.text,
        id: `${group}-text`,
        role: "text",
        collisionGroup: group,
        isCollisionProtected: true,
      }),
    );
    if (i < stepCount - 1) {
      elements.push({
        type: "line",
        x1Mm: x + cardW,
        y1Mm: frame.yMm + frame.hMm / 2,
        x2Mm: x + cardW + gap,
        y2Mm: frame.yMm + frame.hMm / 2,
        stroke: tokens.colors.border,
        widthMm: 0.4,
        id: `${group}-line`,
        role: "decorative",
      });
    }
  }
}

function buildTemplateElements(
  sourceImage: ScannedImage | null,
  brief: PageBrief,
  tokens: LayoutTokens,
  templateId: TemplateId,
): Element[] {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = Math.max(tokens.spacingMm.gutter, 4);
  const footerTop = PAGE_H - margin - tokens.spacingMm.footerHeight;
  const contentBottom = footerTop - gutter;
  const contentW = PAGE_W - margin * 2;
  const preset = buildPreset(templateId, margin, contentW, contentBottom);

  const elements: Element[] = [
    rect({ xMm: 0, yMm: 0, wMm: PAGE_W, hMm: PAGE_H }, tokens.colors.page, {
      id: "bg",
      role: "background",
    }),
    rect({ xMm: 0, yMm: 0, wMm: PAGE_W, hMm: templateId === "COVER_HERO" ? 74 : 62 }, tokens.colors.softAccentAlt, {
      id: "header-band",
      role: "decorative",
    }),
    text({ xMm: margin, yMm: 16, wMm: contentW, hMm: 7 }, brief.narrative.kicker, tokens.fontScalePt.caption, {
      bold: true,
      color: tokens.colors.accentDeep,
      id: "kicker",
      role: "text",
      collisionGroup: "title",
      isCollisionProtected: true,
    }),
    text(preset.titleFrame, brief.narrative.title, templateId === "COVER_HERO" ? tokens.fontScalePt.title : tokens.fontScalePt.subtitle, {
      bold: true,
      color: tokens.colors.text,
      id: "title",
      role: "text",
      collisionGroup: "title",
      isCollisionProtected: true,
    }),
    text(preset.subtitleFrame, brief.narrative.subtitle, tokens.fontScalePt.body, {
      color: tokens.colors.mutedText,
      id: "subtitle",
      role: "text",
      collisionGroup: "title",
      isCollisionProtected: true,
    }),
  ];

  if (preset.chipsFrame) {
    pushChips(elements, preset.chipsFrame, brief.narrative.chips, tokens);
  }
  if (preset.mediaFrame) {
    pushMedia(elements, sourceImage, preset.mediaFrame, tokens, brief, "media");
  }
  if (preset.metricsFrame) {
    pushMetrics(elements, preset.metricsFrame, brief.narrative.metrics, tokens);
  }
  if (preset.flowFrame) {
    pushFlowCards(elements, preset.flowFrame, tokens, brief.narrative.bullets);
  }

  if (preset.calloutFrame) {
    const isAccentCallout =
      templateId === "COVER_HERO" || templateId === "TWO_COLUMN_MEDIA_TEXT" || templateId === "TEXT_ONLY_EDITORIAL";
    pushPanel(
      elements,
      preset.calloutFrame,
      brief.narrative.callout,
      tokens,
      "callout",
      isAccentCallout ? tokens.colors.accentDeep : tokens.colors.highlightSoft,
      isAccentCallout ? tokens.colors.inverseText : tokens.colors.text,
    );
  }

  if (templateId === "TEXT_ONLY_EDITORIAL") {
    const bulletsFrame = preset.bulletsFrame;
    if (bulletsFrame) {
      const gap = 3;
      const cardW = (bulletsFrame.wMm - gap * 2) / 3;
      brief.narrative.bullets.slice(0, 3).forEach((bullet, index) => {
        const x = bulletsFrame.xMm + index * (cardW + gap);
        pushPanel(
          elements,
          { xMm: x, yMm: bulletsFrame.yMm, wMm: cardW, hMm: bulletsFrame.hMm },
          bullet,
          tokens,
          `bullet-card-${index + 1}`,
          tokens.colors.page,
        );
      });
    }
  } else {
    let bodyText = preset.bodyCompact
      ? brief.narrative.body
      : `${brief.narrative.body}\n\n${bulletLines(brief.narrative.bullets.slice(0, 4))}`;
    if (templateId === "PROCESS_FLOW") {
      bodyText = `${brief.narrative.body}\n\n${brief.narrative.callout}`;
    }
    if (templateId === "METRICS_PROOF") {
      bodyText = `${brief.narrative.body}\n\n${bulletLines(brief.narrative.bullets)}`;
    }
    pushPanel(elements, preset.bodyFrame, bodyText, tokens, "body");
  }

  if (templateId !== "TEXT_ONLY_EDITORIAL" && preset.bulletsFrame) {
    pushPanel(elements, preset.bulletsFrame, bulletLines(brief.narrative.bullets), tokens, "bullets", tokens.colors.page);
  }

  addFooter(elements, brief, tokens);
  return elements;
}

export function buildTemplatePage(
  sourceImage: ScannedImage | null,
  brief: PageBrief,
  pageNumber: number,
  tokens: LayoutTokens,
  templateId: TemplateId,
): PageLayout {
  return {
    pageNumber,
    templateId,
    elements: buildTemplateElements(sourceImage, brief, tokens, templateId),
  };
}

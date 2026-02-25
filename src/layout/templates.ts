import type { ScannedImage } from "@/src/io/scanImages";
import type { PageBrief } from "@/src/layout/content";
import type { LayoutTokens } from "@/src/layout/tokens";
import {
  getTemplateSpec,
  type LayoutArchetypeTuning,
  type TemplateId,
  type TemplateZone,
} from "@/src/layout/templateCatalog";
import type {
  Element,
  ImageElement,
  LineElement,
  PageLayout,
  RectElement,
  TextElement,
} from "@/src/layout/types";

type Frame = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
};

type BuildParams = {
  sourceImage: ScannedImage | null;
  brief: PageBrief;
  pageNumber: number;
  tokens: LayoutTokens;
  templateId: TemplateId;
  pageWidthMm: number;
  pageHeightMm: number;
  layoutTuning?: LayoutArchetypeTuning;
  compactLevel?: number;
  showDebugMeta?: boolean;
};

type ResolvedTypography = {
  titlePt: number;
  subtitlePt: number;
  bodyPt: number;
  calloutPt: number;
  captionPt: number;
  microPt: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length < 6) {
    return { r: 127, g: 127, b: 127 };
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return {
    r: Number.isNaN(r) ? 127 : r,
    g: Number.isNaN(g) ? 127 : g,
    b: Number.isNaN(b) ? 127 : b,
  };
}

function colorLuma(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function textColorForFill(fill: string, tokens: LayoutTokens, tone: "normal" | "muted" = "normal"): string {
  const fillLuma = colorLuma(fill);
  if (fillLuma < 0.45) {
    const inverse = tokens.colors.inverseText;
    if (colorLuma(inverse) >= 0.62) {
      return inverse;
    }
    return "#FFFFFF";
  }

  if (tone === "muted") {
    if (colorLuma(tokens.colors.mutedText) <= 0.52) {
      return tokens.colors.mutedText;
    }
    return "#4B5563";
  }

  if (colorLuma(tokens.colors.text) <= 0.52) {
    return tokens.colors.text;
  }
  return "#1F2937";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPosterDocKind(docKind: PageBrief["docKind"]): boolean {
  return docKind === "poster" || docKind === "poster_set";
}

function resolveTypography(brief: PageBrief, templateId: TemplateId, tokens: LayoutTokens): ResolvedTypography {
  if (!isPosterDocKind(brief.docKind)) {
    return {
      titlePt: tokens.fontScalePt.title,
      subtitlePt: tokens.fontScalePt.body,
      bodyPt: tokens.fontScalePt.body,
      calloutPt: tokens.fontScalePt.body,
      captionPt: tokens.fontScalePt.caption,
      microPt: tokens.fontScalePt.micro,
    };
  }

  const isHeroTemplate =
    templateId === "COVER_HERO_BAND" ||
    templateId === "COVER_SPLIT_MEDIA" ||
    templateId === "SECTION_DIVIDER";

  return {
    titlePt: clamp(isHeroTemplate ? tokens.fontScalePt.display : tokens.fontScalePt.title * 1.18, 25, 42),
    subtitlePt: clamp(tokens.fontScalePt.lead * 1.08, 13.5, 20),
    bodyPt: clamp(tokens.fontScalePt.lead, 13.2, 18),
    calloutPt: clamp(tokens.fontScalePt.lead * 1.06, 13.4, 19),
    captionPt: clamp(tokens.fontScalePt.caption * 1.12, 11, 14),
    microPt: clamp(tokens.fontScalePt.micro * 1.08, 10.2, 13),
  };
}

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
  return {
    type: "text",
    ...frame,
    text: value,
    fontSizePt,
    lineHeight: options?.lineHeight ?? 1.25,
    ...options,
  };
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

function line(
  value: Omit<LineElement, "type">,
): LineElement {
  return { type: "line", ...value };
}

function zoneFrame(zone: TemplateZone, insetMm = 0): Frame {
  return {
    xMm: zone.xMm + insetMm,
    yMm: zone.yMm + insetMm,
    wMm: Math.max(0.01, zone.wMm - insetMm * 2),
    hMm: Math.max(0.01, zone.hMm - insetMm * 2),
  };
}

function findZone(zones: TemplateZone[], purpose: TemplateZone["purpose"]): TemplateZone | undefined {
  return zones.find((zone) => zone.purpose === purpose && zone.reserved !== true);
}

function findReservedZone(zones: TemplateZone[], purpose: TemplateZone["purpose"]): TemplateZone | undefined {
  return zones.find((zone) => zone.purpose === purpose && zone.reserved === true);
}

function renderChips(
  elements: Element[],
  zone: TemplateZone,
  chips: string[],
  tokens: LayoutTokens,
  chipFontPt: number,
): void {
  if (chips.length === 0) {
    return;
  }

  const values = chips.slice(0, 3);
  const gap = Math.min(4, zone.wMm * 0.03);
  const chipW = (zone.wMm - gap * (values.length - 1)) / values.length;

  values.forEach((chip, index) => {
    const x = zone.xMm + index * (chipW + gap);
    const group = `chip-${index + 1}`;
    const chipFill = tokens.colors.highlightSoft;

    elements.push(
      rect({ xMm: x, yMm: zone.yMm, wMm: chipW, hMm: zone.hMm }, chipFill, {
        id: `${group}-bg`,
        role: "chip",
        collisionGroup: group,
        isCollisionProtected: true,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: tokens.stroke.defaultMm,
      }),
      text(
        { xMm: x + 1.2, yMm: zone.yMm + 1.2, wMm: chipW - 2.4, hMm: zone.hMm - 2.4 },
        chip,
        chipFontPt,
        {
          id: `${group}-text`,
          role: "chip",
          collisionGroup: group,
          isCollisionProtected: true,
          bold: true,
          align: "center",
          color: textColorForFill(chipFill, tokens, "muted"),
        },
      ),
    );
  });
}

function renderMetricCards(
  elements: Element[],
  zone: TemplateZone,
  metrics: PageBrief["narrative"]["metrics"],
  tokens: LayoutTokens,
  layoutTuning: LayoutArchetypeTuning | undefined,
  debugOnly = false,
  metricFontPt = tokens.fontScalePt.micro,
): void {
  const density = layoutTuning?.cardDensity ?? 0.5;
  const maxCards = density >= 0.62 ? 4 : density <= 0.34 ? 2 : 3;
  const values = metrics.slice(0, maxCards);
  if (values.length === 0) {
    return;
  }

  const gap = Math.min(4, zone.wMm * 0.03);
  const cardW = (zone.wMm - gap * (values.length - 1)) / values.length;

  values.forEach((metric, index) => {
    const x = zone.xMm + index * (cardW + gap);
    const group = `metric-${index + 1}`;
    const metricFill = tokens.colors.page;
    elements.push(
      rect({ xMm: x, yMm: zone.yMm, wMm: cardW, hMm: zone.hMm }, metricFill, {
        id: `${group}-bg`,
        role: "metric",
        collisionGroup: group,
        isCollisionProtected: true,
        debugOnly,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: tokens.stroke.defaultMm,
      }),
      text(
        { xMm: x + 1.4, yMm: zone.yMm + 1.2, wMm: cardW - 2.8, hMm: zone.hMm - 2.2 },
        `${metric.label}\n${metric.value}`,
        metricFontPt,
        {
          id: `${group}-text`,
          role: "metric",
          collisionGroup: group,
          isCollisionProtected: true,
          debugOnly,
          align: "center",
          bold: true,
          color: textColorForFill(metricFill, tokens),
        },
      ),
    );
  });
}

function renderFlowCards(
  elements: Element[],
  zone: TemplateZone,
  bullets: string[],
  tokens: LayoutTokens,
  layoutTuning: LayoutArchetypeTuning | undefined,
  bodyFontPt = tokens.fontScalePt.body,
): void {
  const density = layoutTuning?.cardDensity ?? 0.5;
  const columnTarget = layoutTuning?.columns ?? 2;
  const defaultSteps = density >= 0.62 ? 5 : density <= 0.34 ? 3 : 4;
  const steps = clamp(Math.max(defaultSteps, columnTarget), 3, 6);
  const gap = Math.min(4, zone.wMm * 0.03);
  const cardW = (zone.wMm - gap * (steps - 1)) / steps;

  for (let index = 0; index < steps; index += 1) {
    const x = zone.xMm + index * (cardW + gap);
    const group = `flow-${index + 1}`;
    const flowFill = tokens.colors.softAccent;
    elements.push(
      rect({ xMm: x, yMm: zone.yMm, wMm: cardW, hMm: zone.hMm }, flowFill, {
        id: `${group}-bg`,
        role: "shape",
        collisionGroup: group,
        isCollisionProtected: true,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: tokens.stroke.defaultMm,
      }),
      text(
        { xMm: x + 1.2, yMm: zone.yMm + 1.2, wMm: cardW - 2.4, hMm: zone.hMm - 2.2 },
        `${index + 1}. ${bullets[index] ?? "핵심 단계"}`,
        bodyFontPt,
        {
          id: `${group}-text`,
          role: "text",
          collisionGroup: group,
          isCollisionProtected: true,
          align: "center",
          bold: true,
          color: textColorForFill(flowFill, tokens),
        },
      ),
    );

    if (index < steps - 1) {
      elements.push(
        line({
          x1Mm: x + cardW,
          y1Mm: zone.yMm + zone.hMm / 2,
          x2Mm: x + cardW + gap,
          y2Mm: zone.yMm + zone.hMm / 2,
          stroke: tokens.colors.border,
          widthMm: tokens.stroke.defaultMm,
          id: `${group}-connector`,
          role: "decorative",
        }),
      );
    }
  }
}

function renderTable(
  elements: Element[],
  zone: TemplateZone,
  bullets: string[],
  tokens: LayoutTokens,
  layoutTuning: LayoutArchetypeTuning | undefined,
  bodyFontPt = tokens.fontScalePt.body,
): void {
  const density = layoutTuning?.cardDensity ?? 0.5;
  const rowTarget = density >= 0.62 ? 5 : density <= 0.34 ? 3 : 4;
  const rows = clamp(Math.max(rowTarget, bullets.length > 0 ? 3 : 2), 2, 5);
  const rowH = zone.hMm / rows;

  for (let index = 0; index < rows; index += 1) {
    const y = zone.yMm + index * rowH;
    const rowId = `table-row-${index + 1}`;
    const rowFill = index % 2 === 0 ? tokens.colors.softAccent : tokens.colors.page;
    elements.push(
      rect({ xMm: zone.xMm, yMm: y, wMm: zone.wMm, hMm: rowH }, rowFill, {
        id: `${rowId}-bg`,
        role: "shape",
        collisionGroup: rowId,
        isCollisionProtected: true,
        stroke: tokens.colors.border,
        strokeWidthMm: tokens.stroke.defaultMm,
      }),
      line({
        x1Mm: zone.xMm + zone.wMm * 0.36,
        y1Mm: y,
        x2Mm: zone.xMm + zone.wMm * 0.36,
        y2Mm: y + rowH,
        stroke: tokens.colors.border,
        widthMm: tokens.stroke.defaultMm,
        id: `${rowId}-divider`,
        role: "decorative",
      }),
      text(
        { xMm: zone.xMm + 1.4, yMm: y + 1.2, wMm: zone.wMm * 0.34, hMm: rowH - 2.4 },
        `항목 ${index + 1}`,
        bodyFontPt,
        {
          id: `${rowId}-left`,
          role: "text",
          collisionGroup: rowId,
          isCollisionProtected: true,
          bold: true,
          color: textColorForFill(rowFill, tokens, "muted"),
        },
      ),
      text(
        { xMm: zone.xMm + zone.wMm * 0.38, yMm: y + 1.2, wMm: zone.wMm * 0.6, hMm: rowH - 2.4 },
        bullets[index] ?? "비교 메모",
        bodyFontPt,
        {
          id: `${rowId}-right`,
          role: "text",
          collisionGroup: rowId,
          isCollisionProtected: true,
          color: textColorForFill(rowFill, tokens),
        },
      ),
    );
  }
}

function renderMedia(
  elements: Element[],
  zone: TemplateZone,
  sourceImage: ScannedImage | null,
  brief: PageBrief,
  tokens: LayoutTokens,
  required: boolean,
  placeholderFontPt = tokens.fontScalePt.body,
): void {
  const group = `media-${zone.id}`;
  if (!sourceImage && !required) {
    return;
  }

  const mediaFill = sourceImage ? tokens.colors.softAccent : tokens.colors.highlightSoft;
  elements.push(
    rect(zoneFrame(zone), mediaFill, {
      id: `${group}-frame`,
      role: "media",
      collisionGroup: group,
      isCollisionProtected: true,
      radiusMm: tokens.radiusMm.md,
      stroke: tokens.colors.border,
      strokeWidthMm: tokens.stroke.defaultMm,
    }),
  );

  if (!sourceImage) {
    elements.push(
      text(
        zoneFrame(zone, 2),
        "이미지 없음",
        placeholderFontPt,
        {
          id: `${group}-placeholder`,
          role: "media",
          collisionGroup: group,
          isCollisionProtected: true,
          align: "center",
          color: textColorForFill(mediaFill, tokens, "muted"),
        },
      ),
    );
    return;
  }

  elements.push(
    image(sourceImage, zoneFrame(zone, 1), brief.imageFit, {
      id: `${group}-image`,
      role: "media",
      collisionGroup: group,
      isCollisionProtected: true,
    }),
  );
}

function buildElements(params: BuildParams): Element[] {
  const compactLevel = params.compactLevel ?? 0;
  const showDebugMeta = params.showDebugMeta ?? false;
  const typography = resolveTypography(params.brief, params.templateId, params.tokens);
  const spec = getTemplateSpec(params.templateId);
  const zones = spec.buildZones({
    pageWidthMm: params.pageWidthMm,
    pageHeightMm: params.pageHeightMm,
    tokens: params.tokens,
    layoutTuning: params.layoutTuning,
  });

  const headerZone = findReservedZone(zones, "header");
  const footerZone = findReservedZone(zones, "footer");
  const titleZone = findZone(zones, "title");
  const subtitleZone = findZone(zones, "subtitle");
  const bodyZone = findZone(zones, "body");
  const mediaZone = findZone(zones, "media");
  const metricsZone = findZone(zones, "metrics");
  const chipsZone = findZone(zones, "chips");
  const flowZone = findZone(zones, "flow");
  const tableZone = findZone(zones, "table");
  const calloutZone = findZone(zones, "callout");

  const elements: Element[] = [];

  elements.push(
    rect({ xMm: 0, yMm: 0, wMm: params.pageWidthMm, hMm: params.pageHeightMm }, params.tokens.colors.page, {
      id: "bg",
      role: "background",
    }),
  );

  if (headerZone) {
    const headerFill = params.tokens.colors.softAccentAlt;
    elements.push(
      rect(zoneFrame(headerZone), headerFill, {
        id: "header-band",
        role: "header",
        fillOpacity: params.tokens.background.intensity,
      }),
      text(
        zoneFrame(headerZone, 1.2),
        params.brief.narrative.kicker,
        typography.captionPt,
        {
          id: "kicker",
          role: "header",
          bold: true,
          color: textColorForFill(headerFill, params.tokens, "muted"),
        },
      ),
    );
  }

  if (titleZone) {
    elements.push(
      text(zoneFrame(titleZone), params.brief.narrative.title, typography.titlePt, {
        id: "title",
        role: "text",
        collisionGroup: "title",
        isCollisionProtected: true,
        bold: true,
        color: params.tokens.colors.text,
      }),
    );
  }

  if (subtitleZone) {
    elements.push(
      text(zoneFrame(subtitleZone), params.brief.narrative.subtitle, typography.subtitlePt, {
        id: "subtitle",
        role: "text",
        collisionGroup: "title",
        isCollisionProtected: true,
        color: params.tokens.colors.mutedText,
      }),
    );
  }

  if (chipsZone && compactLevel < 1) {
    renderChips(elements, chipsZone, params.brief.narrative.chips, params.tokens, typography.microPt);
  }

  if (mediaZone) {
    renderMedia(
      elements,
      mediaZone,
      params.sourceImage,
      params.brief,
      params.tokens,
      spec.imagePolicy === "required",
      typography.bodyPt,
    );
  }

  if (metricsZone && compactLevel < 2) {
    const isDebugMeta = params.brief.narrative.metricsDebugOnly;
    if (!isDebugMeta || showDebugMeta) {
      renderMetricCards(
        elements,
        metricsZone,
        params.brief.narrative.metrics,
        params.tokens,
        params.layoutTuning,
        isDebugMeta,
        typography.microPt,
      );
    }
  }

  if (flowZone) {
    renderFlowCards(
      elements,
      flowZone,
      params.brief.narrative.bullets,
      params.tokens,
      params.layoutTuning,
      typography.bodyPt,
    );
  }

  if (tableZone && compactLevel < 2) {
    renderTable(
      elements,
      tableZone,
      params.brief.narrative.bullets,
      params.tokens,
      params.layoutTuning,
      typography.bodyPt,
    );
  }

  if (bodyZone) {
    const bullets = params.brief.narrative.bullets.slice(0, compactLevel >= 1 ? 3 : 5);
    const bodyContent = `${params.brief.narrative.body}\n\n${bullets
      .map((lineValue) => `- ${lineValue}`)
      .join("\n")}`;

    const bodyFill = params.tokens.colors.softAccent;
    elements.push(
      rect(zoneFrame(bodyZone), bodyFill, {
        id: "body-bg",
        role: "shape",
        collisionGroup: "body",
        isCollisionProtected: true,
        radiusMm: params.tokens.radiusMm.sm,
        stroke: params.tokens.colors.border,
        strokeWidthMm: params.tokens.stroke.defaultMm,
      }),
      text(zoneFrame(bodyZone, 2.2), bodyContent, typography.bodyPt, {
        id: "body-text",
        role: "text",
        collisionGroup: "body",
        isCollisionProtected: true,
        color: textColorForFill(bodyFill, params.tokens),
      }),
    );
  }

  if (calloutZone) {
    const accent = params.templateId === "CTA_CONTACT" || params.templateId.startsWith("COVER");
    const calloutFill = accent ? params.tokens.colors.accentDeep : params.tokens.colors.highlightSoft;
    elements.push(
      rect(zoneFrame(calloutZone), calloutFill, {
        id: "callout-bg",
        role: "shape",
        collisionGroup: "callout",
        isCollisionProtected: true,
        radiusMm: params.tokens.radiusMm.md,
      }),
      text(zoneFrame(calloutZone, 2), params.brief.narrative.callout, typography.calloutPt, {
        id: "callout-text",
        role: "text",
        collisionGroup: "callout",
        isCollisionProtected: true,
        bold: true,
        color: textColorForFill(calloutFill, params.tokens),
      }),
    );
  }

  if (footerZone) {
    elements.push(
      line({
        x1Mm: footerZone.xMm,
        y1Mm: footerZone.yMm + 0.8,
        x2Mm: footerZone.xMm + footerZone.wMm,
        y2Mm: footerZone.yMm + 0.8,
        stroke: params.tokens.colors.border,
        widthMm: params.tokens.stroke.defaultMm,
        id: "footer-divider",
        role: "footer",
      }),
      text(zoneFrame(footerZone, 1.4), params.brief.narrative.footer, typography.captionPt, {
        id: "footer-text",
        role: "footer",
        color: params.tokens.colors.mutedText,
      }),
    );
  }

  return elements;
}

export function buildTemplatePage(params: BuildParams): PageLayout {
  return {
    pageNumber: params.pageNumber,
    pageRole: params.brief.pageRole,
    templateId: params.templateId,
    widthMm: params.pageWidthMm,
    heightMm: params.pageHeightMm,
    elements: buildElements(params),
  };
}


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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function renderChips(elements: Element[], zone: TemplateZone, chips: string[], tokens: LayoutTokens): void {
  if (chips.length === 0) {
    return;
  }

  const values = chips.slice(0, 3);
  const gap = Math.min(4, zone.wMm * 0.03);
  const chipW = (zone.wMm - gap * (values.length - 1)) / values.length;

  values.forEach((chip, index) => {
    const x = zone.xMm + index * (chipW + gap);
    const group = `chip-${index + 1}`;

    elements.push(
      rect({ xMm: x, yMm: zone.yMm, wMm: chipW, hMm: zone.hMm }, tokens.colors.highlightSoft, {
        id: `${group}-bg`,
        role: "chip",
        collisionGroup: group,
        isCollisionProtected: true,
        debugOnly: true,
        radiusMm: tokens.radiusMm.sm,
        stroke: tokens.colors.border,
        strokeWidthMm: tokens.stroke.defaultMm,
      }),
      text(
        { xMm: x + 1.2, yMm: zone.yMm + 1.2, wMm: chipW - 2.4, hMm: zone.hMm - 2.4 },
        chip,
        tokens.fontScalePt.micro,
        {
          id: `${group}-text`,
          role: "chip",
          collisionGroup: group,
          isCollisionProtected: true,
          debugOnly: true,
          bold: true,
          align: "center",
          color: tokens.colors.accentDeep,
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
    elements.push(
      rect({ xMm: x, yMm: zone.yMm, wMm: cardW, hMm: zone.hMm }, tokens.colors.page, {
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
        tokens.fontScalePt.micro,
        {
          id: `${group}-text`,
          role: "metric",
          collisionGroup: group,
          isCollisionProtected: true,
          debugOnly,
          align: "center",
          bold: true,
          color: tokens.colors.text,
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
    elements.push(
      rect({ xMm: x, yMm: zone.yMm, wMm: cardW, hMm: zone.hMm }, tokens.colors.softAccent, {
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
        tokens.fontScalePt.body,
        {
          id: `${group}-text`,
          role: "text",
          collisionGroup: group,
          isCollisionProtected: true,
          align: "center",
          bold: true,
          color: tokens.colors.text,
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
): void {
  const density = layoutTuning?.cardDensity ?? 0.5;
  const rowTarget = density >= 0.62 ? 5 : density <= 0.34 ? 3 : 4;
  const rows = clamp(Math.max(rowTarget, bullets.length > 0 ? 3 : 2), 2, 5);
  const rowH = zone.hMm / rows;

  for (let index = 0; index < rows; index += 1) {
    const y = zone.yMm + index * rowH;
    const rowId = `table-row-${index + 1}`;
    elements.push(
      rect({ xMm: zone.xMm, yMm: y, wMm: zone.wMm, hMm: rowH }, index % 2 === 0 ? tokens.colors.softAccent : tokens.colors.page, {
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
        tokens.fontScalePt.body,
        {
          id: `${rowId}-left`,
          role: "text",
          collisionGroup: rowId,
          isCollisionProtected: true,
          bold: true,
          color: tokens.colors.mutedText,
        },
      ),
      text(
        { xMm: zone.xMm + zone.wMm * 0.38, yMm: y + 1.2, wMm: zone.wMm * 0.6, hMm: rowH - 2.4 },
        bullets[index] ?? "비교 메모",
        tokens.fontScalePt.body,
        {
          id: `${rowId}-right`,
          role: "text",
          collisionGroup: rowId,
          isCollisionProtected: true,
          color: tokens.colors.text,
        },
      ),
    );
  }
}

function renderMedia(elements: Element[], zone: TemplateZone, sourceImage: ScannedImage | null, brief: PageBrief, tokens: LayoutTokens): void {
  const group = `media-${zone.id}`;
  elements.push(
    rect(zoneFrame(zone), tokens.colors.softAccent, {
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
        tokens.fontScalePt.body,
        {
          id: `${group}-placeholder`,
          role: "media",
          collisionGroup: group,
          isCollisionProtected: true,
          align: "center",
          color: tokens.colors.mutedText,
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
    elements.push(
      rect(zoneFrame(headerZone), params.tokens.colors.softAccentAlt, {
        id: "header-band",
        role: "header",
        fillOpacity: params.tokens.background.intensity,
      }),
      text(
        zoneFrame(headerZone, 1.2),
        params.brief.narrative.kicker,
        params.tokens.fontScalePt.caption,
        {
          id: "kicker",
          role: "header",
          bold: true,
          color: params.tokens.colors.accentDeep,
        },
      ),
    );
  }

  if (titleZone) {
    elements.push(
      text(zoneFrame(titleZone), params.brief.narrative.title, params.tokens.fontScalePt.title, {
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
      text(zoneFrame(subtitleZone), params.brief.narrative.subtitle, params.tokens.fontScalePt.body, {
        id: "subtitle",
        role: "text",
        collisionGroup: "title",
        isCollisionProtected: true,
        color: params.tokens.colors.mutedText,
      }),
    );
  }

  if (chipsZone && compactLevel < 1 && showDebugMeta) {
    renderChips(elements, chipsZone, params.brief.narrative.chips, params.tokens);
  }

  if (mediaZone) {
    renderMedia(elements, mediaZone, params.sourceImage, params.brief, params.tokens);
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
      );
    }
  }

  if (flowZone) {
    renderFlowCards(elements, flowZone, params.brief.narrative.bullets, params.tokens, params.layoutTuning);
  }

  if (tableZone && compactLevel < 2) {
    renderTable(elements, tableZone, params.brief.narrative.bullets, params.tokens, params.layoutTuning);
  }

  if (bodyZone) {
    const bullets = params.brief.narrative.bullets.slice(0, compactLevel >= 1 ? 3 : 5);
    const bodyContent = `${params.brief.narrative.body}\n\n${bullets
      .map((lineValue) => `- ${lineValue}`)
      .join("\n")}`;

    elements.push(
      rect(zoneFrame(bodyZone), params.tokens.colors.softAccent, {
        id: "body-bg",
        role: "shape",
        collisionGroup: "body",
        isCollisionProtected: true,
        radiusMm: params.tokens.radiusMm.sm,
        stroke: params.tokens.colors.border,
        strokeWidthMm: params.tokens.stroke.defaultMm,
      }),
      text(zoneFrame(bodyZone, 2.2), bodyContent, params.tokens.fontScalePt.body, {
        id: "body-text",
        role: "text",
        collisionGroup: "body",
        isCollisionProtected: true,
        color: params.tokens.colors.text,
      }),
    );
  }

  if (calloutZone) {
    const accent = params.templateId === "CTA_CONTACT" || params.templateId.startsWith("COVER");
    elements.push(
      rect(zoneFrame(calloutZone), accent ? params.tokens.colors.accentDeep : params.tokens.colors.highlightSoft, {
        id: "callout-bg",
        role: "shape",
        collisionGroup: "callout",
        isCollisionProtected: true,
        radiusMm: params.tokens.radiusMm.md,
      }),
      text(zoneFrame(calloutZone, 2), params.brief.narrative.callout, params.tokens.fontScalePt.body, {
        id: "callout-text",
        role: "text",
        collisionGroup: "callout",
        isCollisionProtected: true,
        bold: true,
        color: accent ? params.tokens.colors.inverseText : params.tokens.colors.text,
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
      text(zoneFrame(footerZone, 1.4), params.brief.narrative.footer, params.tokens.fontScalePt.caption, {
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


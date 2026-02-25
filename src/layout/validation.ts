import type { Element, LayoutValidationIssue, PageLayout, TextElement } from "@/src/layout/types";

type Box = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  element: Element;
  elementIndex: number;
};

type ValidationOptions = {
  headerBottomMm?: number;
  footerTopMm?: number;
  minBodyFontPt?: number;
  minCaptionFontPt?: number;
  minMicroFontPt?: number;
  copyDensity?: {
    minTextChars: number;
    minTextBlocks: number;
    minBodyFontPt: number;
  };
};

const MM_PER_PT = 25.4 / 72;
const EPS = 0.05;
const A4_AREA_MM2 = 210 * 297;

type ReadabilityMinima = {
  bodyPt: number;
  captionPt: number;
  microPt: number;
};

type DensityThreshold = {
  minChars: number;
  minCoverage: number;
  minGroups: number;
  requireBodyLike: boolean;
};

type DensityStats = {
  textChars: number;
  coverageRatio: number;
  contentGroups: number;
  hasBodyLike: boolean;
};

type CopyDensityStats = {
  textChars: number;
  textBlocks: number;
  bodyFontMinPt: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readabilityScaleForPage(page: PageLayout): number {
  const area = Math.max(1, page.widthMm * page.heightMm);
  const areaScale = Math.sqrt(area / A4_AREA_MM2);
  return clamp(areaScale, 0.85, 1.35);
}

function resolveReadabilityMinima(page: PageLayout, options: ValidationOptions): ReadabilityMinima {
  const scale = readabilityScaleForPage(page);
  const bodyDefault = Number((11 * scale).toFixed(2));
  const captionDefault = Number((10 * scale).toFixed(2));
  const microDefault = Number((9.5 * scale).toFixed(2));

  return {
    bodyPt: options.minBodyFontPt ?? bodyDefault,
    captionPt: options.minCaptionFontPt ?? captionDefault,
    microPt: options.minMicroFontPt ?? microDefault,
  };
}

function isKeyTextElement(element: TextElement): boolean {
  if (element.debugOnly) {
    return false;
  }
  return element.role !== "chip" && element.role !== "metric" && element.role !== "footer";
}

export function hasForbiddenEllipsis(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes("…")) {
    return true;
  }
  return /\.\.\.$/.test(trimmed);
}

function intersects(a: Box, b: Box): boolean {
  return a.xMm < b.xMm + b.wMm && a.xMm + a.wMm > b.xMm && a.yMm < b.yMm + b.hMm && a.yMm + a.hMm > b.yMm;
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.max(0, Math.min(a.xMm + a.wMm, b.xMm + b.wMm) - Math.max(a.xMm, b.xMm));
  const h = Math.max(0, Math.min(a.yMm + a.hMm, b.yMm + b.hMm) - Math.max(a.yMm, b.yMm));
  return w * h;
}

function hasOpaqueFill(element: Element): boolean {
  if (element.type === "image") {
    return true;
  }
  if (element.type !== "rect") {
    return false;
  }
  return (element.fillOpacity ?? 1) >= 0.75;
}

function toBox(element: Element, elementIndex: number): Box | null {
  if (element.type === "line") {
    return null;
  }
  return {
    xMm: element.xMm,
    yMm: element.yMm,
    wMm: element.wMm,
    hMm: element.hMm,
    element,
    elementIndex,
  };
}

function checkBounds(page: PageLayout, issues: LayoutValidationIssue[]): void {
  page.elements.forEach((element, index) => {
    if (element.type === "line") {
      const points = [
        { x: element.x1Mm, y: element.y1Mm },
        { x: element.x2Mm, y: element.y2Mm },
      ];

      for (const point of points) {
        if (point.x < -EPS || point.y < -EPS || point.x > page.widthMm + EPS || point.y > page.heightMm + EPS) {
          issues.push({
            code: "boundary",
            message: `Element exceeds page bounds (${element.id ?? `line-${index}`})`,
            elementId: element.id,
            elementIndex: index,
          });
        }
      }
      return;
    }

    const x2 = element.xMm + element.wMm;
    const y2 = element.yMm + element.hMm;

    if (element.xMm < -EPS || element.yMm < -EPS || x2 > page.widthMm + EPS || y2 > page.heightMm + EPS) {
      issues.push({
        code: "boundary",
        message: `Element exceeds page bounds (${element.id ?? `${element.type}-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function checkReservedLanes(page: PageLayout, options: ValidationOptions, issues: LayoutValidationIssue[]): void {
  const { headerBottomMm, footerTopMm } = options;

  page.elements.forEach((element, index) => {
    const isHeaderAllowed =
      element.role === "header" ||
      element.role === "background" ||
      element.role === "decorative";
    const isFooterAllowed =
      element.role === "footer" ||
      element.role === "background" ||
      element.role === "decorative";

    if (element.type === "line") {
      const yMin = Math.min(element.y1Mm, element.y2Mm);
      const yMax = Math.max(element.y1Mm, element.y2Mm);

      if (typeof headerBottomMm === "number" && yMin < headerBottomMm - EPS && !isHeaderAllowed) {
        issues.push({
          code: "reserved-lane",
          message: `Element invades reserved header lane (${element.id ?? `line-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }

      if (typeof footerTopMm === "number" && yMax > footerTopMm + EPS && !isFooterAllowed) {
        issues.push({
          code: "reserved-lane",
          message: `Element invades reserved footer lane (${element.id ?? `line-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }
      return;
    }

    const yMin = element.yMm;
    const yMax = element.yMm + element.hMm;

    if (typeof headerBottomMm === "number" && yMin < headerBottomMm - EPS && !isHeaderAllowed) {
      issues.push({
        code: "reserved-lane",
        message: `Element invades reserved header lane (${element.id ?? `${element.type}-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }

    if (typeof footerTopMm === "number" && yMax > footerTopMm + EPS && !isFooterAllowed) {
      issues.push({
        code: "reserved-lane",
        message: `Element invades reserved footer lane (${element.id ?? `${element.type}-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function checkCollisions(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const boxes = page.elements
    .map((element, index) => toBox(element, index))
    .filter((item): item is Box => item !== null)
    .filter((box) => box.element.isCollisionProtected === true);

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];

      if (!left || !right) {
        continue;
      }

      if (
        left.element.collisionGroup &&
        right.element.collisionGroup &&
        left.element.collisionGroup === right.element.collisionGroup
      ) {
        continue;
      }

      if (!intersects(left, right)) {
        continue;
      }

      if (overlapArea(left, right) <= 0.5) {
        continue;
      }

      issues.push({
        code: "collision",
        message: `Collision detected (${left.element.id ?? left.elementIndex} vs ${right.element.id ?? right.elementIndex})`,
        elementId: left.element.id,
        elementIndex: left.elementIndex,
      });
    }
  }
}

function estimateTextLines(element: TextElement): { estimatedLines: number; maxLines: number } {
  const lineHeight = element.lineHeight ?? 1.25;
  const charWidthMm = Math.max(element.fontSizePt * MM_PER_PT * 0.52, 0.8);
  const charsPerLine = Math.max(1, Math.floor(element.wMm / charWidthMm));

  const sourceLines = element.text.split(/\r?\n/);
  let estimatedLines = 0;

  for (const sourceLine of sourceLines) {
    const charCount = sourceLine.trim().length === 0 ? 1 : sourceLine.length;
    estimatedLines += Math.max(1, Math.ceil(charCount / charsPerLine));
  }

  const lineHeightMm = element.fontSizePt * MM_PER_PT * lineHeight;
  const maxLines = Math.max(1, Math.floor(element.hMm / lineHeightMm));
  return { estimatedLines, maxLines };
}

function minFontForText(element: TextElement, minima: ReadabilityMinima): number {
  if (element.role === "chip" || element.role === "metric") {
    return minima.microPt;
  }
  if (element.role === "header" || element.role === "footer") {
    return minima.captionPt;
  }
  return minima.bodyPt;
}

function normalizeTemplateId(page: PageLayout): string {
  return String(page.templateId || "").toUpperCase();
}

function densityThresholdForPage(page: PageLayout): DensityThreshold {
  const templateId = normalizeTemplateId(page);

  if (templateId === "SECTION_DIVIDER") {
    return {
      minChars: 66,
      minCoverage: 0.22,
      minGroups: 3,
      requireBodyLike: true,
    };
  }

  if (templateId === "GALLERY_SINGLE") {
    return {
      minChars: 36,
      minCoverage: 0.18,
      minGroups: 2,
      requireBodyLike: true,
    };
  }

  if (templateId === "QUOTE_FOCUS") {
    return {
      minChars: 58,
      minCoverage: 0.2,
      minGroups: 3,
      requireBodyLike: true,
    };
  }

  if (templateId === "CTA_CONTACT") {
    return {
      minChars: 64,
      minCoverage: 0.21,
      minGroups: 3,
      requireBodyLike: true,
    };
  }

  if (templateId.startsWith("COVER_")) {
    return {
      minChars: 76,
      minCoverage: 0.24,
      minGroups: 3,
      requireBodyLike: true,
    };
  }

  return {
    minChars: 72,
    minCoverage: 0.21,
    minGroups: 3,
    requireBodyLike: true,
  };
}

function densityGroupKey(element: Element, index: number): string {
  const group = element.collisionGroup?.trim();
  if (group) {
    return group;
  }
  const id = element.id?.trim();
  if (id) {
    return id;
  }
  return `${element.type}-${index}`;
}

function elementArea(element: Element): number {
  if (element.type === "line") {
    return 0;
  }
  return Math.max(0, element.wMm * element.hMm);
}

function isBodyLikeElement(element: Element): boolean {
  if (element.type === "line") {
    return false;
  }

  if (element.role === "media" || element.role === "metric" || element.role === "chip") {
    return true;
  }

  const id = (element.id ?? "").toLowerCase();
  if (id.includes("body") || id.includes("callout") || id.includes("table") || id.includes("flow") || id.includes("metric")) {
    return true;
  }

  return false;
}

function collectDensityStats(page: PageLayout): DensityStats {
  const pageArea = Math.max(1, page.widthMm * page.heightMm);
  const groupArea = new Map<string, number>();
  let textChars = 0;
  let hasBodyLike = false;

  page.elements.forEach((element, index) => {
    if (element.debugOnly) {
      return;
    }

    if (element.role === "background" || element.role === "header" || element.role === "footer" || element.role === "decorative") {
      return;
    }

    if (element.type === "text") {
      const normalized = element.text.replace(/\s+/g, " ").trim();
      textChars += normalized.length;
    }

    if (isBodyLikeElement(element)) {
      hasBodyLike = true;
    }

    const area = elementArea(element);
    if (area <= 0) {
      return;
    }

    const key = densityGroupKey(element, index);
    const previous = groupArea.get(key) ?? 0;
    if (area > previous) {
      groupArea.set(key, area);
    }
  });

  const usedArea = [...groupArea.values()].reduce((acc, value) => acc + value, 0);
  return {
    textChars,
    coverageRatio: usedArea / pageArea,
    contentGroups: groupArea.size,
    hasBodyLike,
  };
}

function checkContentDensity(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const threshold = densityThresholdForPage(page);
  const stats = collectDensityStats(page);
  const reasons: string[] = [];

  if (stats.textChars < threshold.minChars) {
    reasons.push(`text ${stats.textChars}/${threshold.minChars}`);
  }
  if (stats.coverageRatio < threshold.minCoverage) {
    reasons.push(`coverage ${stats.coverageRatio.toFixed(2)}/${threshold.minCoverage.toFixed(2)}`);
  }
  if (stats.contentGroups < threshold.minGroups) {
    reasons.push(`groups ${stats.contentGroups}/${threshold.minGroups}`);
  }
  if (threshold.requireBodyLike && !stats.hasBodyLike) {
    reasons.push("body-like component missing");
  }

  if (reasons.length === 0) {
    return;
  }

  issues.push({
    code: "content-density",
    message: `low content density: ${reasons.join(", ")}`,
  });
}

function isCopyDensityText(element: TextElement): boolean {
  if (element.debugOnly) {
    return false;
  }
  return element.role !== "header";
}

function isBodyLikeTextForDensity(element: TextElement): boolean {
  if (!isCopyDensityText(element)) {
    return false;
  }
  const id = (element.id ?? "").toLowerCase();
  return id.includes("body") || id.includes("callout") || id.includes("table") || id.includes("flow");
}

function collectCopyDensityStats(page: PageLayout): CopyDensityStats {
  let textChars = 0;
  let textBlocks = 0;
  let bodyFontMinPt = Number.POSITIVE_INFINITY;

  for (const element of page.elements) {
    if (element.type !== "text") {
      continue;
    }
    if (!isCopyDensityText(element)) {
      continue;
    }

    const normalized = element.text.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }

    textChars += normalized.length;
    textBlocks += 1;

    if (isBodyLikeTextForDensity(element)) {
      bodyFontMinPt = Math.min(bodyFontMinPt, element.fontSizePt);
    }
  }

  return {
    textChars,
    textBlocks,
    bodyFontMinPt: Number.isFinite(bodyFontMinPt) ? bodyFontMinPt : 0,
  };
}

function checkCopyDensity(
  page: PageLayout,
  options: ValidationOptions,
  issues: LayoutValidationIssue[],
): void {
  const threshold = options.copyDensity;
  if (!threshold) {
    return;
  }

  const stats = collectCopyDensityStats(page);
  const reasons: string[] = [];

  if (stats.textChars < threshold.minTextChars) {
    reasons.push(`text_chars ${stats.textChars}/${threshold.minTextChars}`);
  }
  if (stats.textBlocks < threshold.minTextBlocks) {
    reasons.push(`text_blocks ${stats.textBlocks}/${threshold.minTextBlocks}`);
  }
  if (stats.bodyFontMinPt < threshold.minBodyFontPt) {
    reasons.push(`body_font_min_pt ${stats.bodyFontMinPt.toFixed(1)}/${threshold.minBodyFontPt.toFixed(1)}`);
  }

  if (reasons.length === 0) {
    return;
  }

  issues.push({
    code: "copy-density",
    message: `copy density gate failed: ${reasons.join(", ")}`,
  });
}

function checkTextTruncation(page: PageLayout, issues: LayoutValidationIssue[]): void {
  page.elements.forEach((element, index) => {
    if (element.type !== "text" || !isKeyTextElement(element)) {
      return;
    }

    if (hasForbiddenEllipsis(element.text)) {
      issues.push({
        code: "text-truncation",
        message: `Forbidden ellipsis/truncation marker found (${element.id ?? `text-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function checkMinSize(page: PageLayout, minima: ReadabilityMinima, issues: LayoutValidationIssue[]): void {
  page.elements.forEach((element, index) => {
    if (element.type === "text") {
      const minFontPt = minFontForText(element, minima);
      if (element.fontSizePt < minFontPt - EPS) {
        issues.push({
          code: "min-size",
          message: `Text size below minimum (${element.fontSizePt.toFixed(1)}pt < ${minFontPt.toFixed(1)}pt)`,
          elementId: element.id,
          elementIndex: index,
        });
      }

      const { estimatedLines, maxLines } = estimateTextLines(element);
      if (estimatedLines > maxLines) {
        issues.push({
          code: "min-size",
          message: `Text overflow estimated (${estimatedLines}/${maxLines}) (${element.id ?? `text-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }
      return;
    }

    if (element.type !== "line") {
      if (element.wMm < 2 || element.hMm < 2) {
        issues.push({
          code: "min-size",
          message: `Element too small (${element.id ?? `${element.type}-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }
    }
  });
}

function checkLayering(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const boxes = page.elements
    .map((element, index) => toBox(element, index))
    .filter((item): item is Box => item !== null);

  for (const textBox of boxes) {
    if (textBox.element.type !== "text") {
      continue;
    }

    for (let index = textBox.elementIndex + 1; index < page.elements.length; index += 1) {
      const later = page.elements[index];

      if (!later || later.allowTextOcclusion || !hasOpaqueFill(later)) {
        continue;
      }

      const laterBox = toBox(later, index);
      if (!laterBox || !intersects(textBox, laterBox) || overlapArea(textBox, laterBox) <= 0.5) {
        continue;
      }

      issues.push({
        code: "layering",
        message: `Text occluded by later opaque element (${textBox.element.id ?? `text-${textBox.elementIndex}`})`,
        elementId: textBox.element.id,
        elementIndex: textBox.elementIndex,
      });
      break;
    }
  }
}

export function validatePageLayout(
  page: PageLayout,
  options: ValidationOptions = {},
): { passed: boolean; issues: LayoutValidationIssue[] } {
  const issues: LayoutValidationIssue[] = [];
  const minima = resolveReadabilityMinima(page, options);
  checkBounds(page, issues);
  checkReservedLanes(page, options, issues);
  checkCollisions(page, issues);
  checkMinSize(page, minima, issues);
  checkContentDensity(page, issues);
  checkCopyDensity(page, options, issues);
  checkTextTruncation(page, issues);
  checkLayering(page, issues);
  return {
    passed: issues.length === 0,
    issues,
  };
}

function cleanElementForSignature(element: Element): unknown {
  if (element.type === "line") {
    return {
      t: "line",
      id: element.id ?? "",
      x1: Number(element.x1Mm.toFixed(3)),
      y1: Number(element.y1Mm.toFixed(3)),
      x2: Number(element.x2Mm.toFixed(3)),
      y2: Number(element.y2Mm.toFixed(3)),
      w: Number(element.widthMm.toFixed(3)),
    };
  }

  return {
    t: element.type,
    id: element.id ?? "",
    x: Number(element.xMm.toFixed(3)),
    y: Number(element.yMm.toFixed(3)),
    w: Number(element.wMm.toFixed(3)),
    h: Number(element.hMm.toFixed(3)),
    role: element.role ?? "",
    text: element.type === "text" ? element.text : "",
  };
}

export function createLayoutSignature(pages: PageLayout[]): string {
  return JSON.stringify(
    pages.map((page) => ({
      n: page.pageNumber,
      t: page.templateId,
      w: Number(page.widthMm.toFixed(3)),
      h: Number(page.heightMm.toFixed(3)),
      e: page.elements.map(cleanElementForSignature),
    })),
  );
}


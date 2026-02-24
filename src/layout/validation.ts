import type { Element, LayoutValidationIssue, PageLayout, TextElement } from "@/src/layout/types";
import { PAGE_SIZE_A4_PORTRAIT } from "@/src/layout/types";

type Box = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  element: Element;
  elementIndex: number;
};

type ValidationOptions = {
  footerTopMm?: number;
};

const MM_PER_PT = 25.4 / 72;
const EPS = 0.05;

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
  return { xMm: element.xMm, yMm: element.yMm, wMm: element.wMm, hMm: element.hMm, element, elementIndex };
}

function boundaryChecks(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const pageW = PAGE_SIZE_A4_PORTRAIT.widthMm;
  const pageH = PAGE_SIZE_A4_PORTRAIT.heightMm;

  page.elements.forEach((element, index) => {
    if (element.type === "line") {
      const points = [
        { x: element.x1Mm, y: element.y1Mm },
        { x: element.x2Mm, y: element.y2Mm },
      ];
      for (const point of points) {
        if (point.x < -EPS || point.y < -EPS || point.x > pageW + EPS || point.y > pageH + EPS) {
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
    if (element.xMm < -EPS || element.yMm < -EPS || x2 > pageW + EPS || y2 > pageH + EPS) {
      issues.push({
        code: "boundary",
        message: `Element exceeds page bounds (${element.id ?? `${element.type}-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function footerLaneChecks(
  page: PageLayout,
  footerTopMm: number | undefined,
  issues: LayoutValidationIssue[],
): void {
  if (typeof footerTopMm !== "number") {
    return;
  }

  page.elements.forEach((element, index) => {
    const isExemptRole =
      element.role === "footer" || element.role === "background" || element.role === "decorative";

    if (element.type === "line") {
      const yMax = Math.max(element.y1Mm, element.y2Mm);
      if (!isExemptRole && yMax > footerTopMm + EPS) {
        issues.push({
          code: "footer-lane",
          message: `Element invades reserved footer lane (${element.id ?? `line-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }
      return;
    }

    const y2 = element.yMm + element.hMm;
    if (!isExemptRole && y2 > footerTopMm + EPS) {
      issues.push({
        code: "footer-lane",
        message: `Element invades reserved footer lane (${element.id ?? `${element.type}-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function collisionChecks(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const protectedBoxes = page.elements
    .map((element, index) => toBox(element, index))
    .filter((box): box is Box => box !== null)
    .filter((box) => box.element.isCollisionProtected === true);

  for (let i = 0; i < protectedBoxes.length; i += 1) {
    const left = protectedBoxes[i];
    for (let j = i + 1; j < protectedBoxes.length; j += 1) {
      const right = protectedBoxes[j];
      if (left.element.collisionGroup && right.element.collisionGroup && left.element.collisionGroup === right.element.collisionGroup) {
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
        message: `Collision between protected zones (${left.element.id ?? left.elementIndex} vs ${right.element.id ?? right.elementIndex})`,
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
  for (const line of sourceLines) {
    const lineChars = line.trim().length === 0 ? 1 : line.length;
    estimatedLines += Math.max(1, Math.ceil(lineChars / charsPerLine));
  }

  const lineHeightMm = element.fontSizePt * MM_PER_PT * lineHeight;
  const maxLines = Math.max(1, Math.floor(element.hMm / lineHeightMm));
  return { estimatedLines, maxLines };
}

function textFitChecks(page: PageLayout, issues: LayoutValidationIssue[]): void {
  page.elements.forEach((element, index) => {
    if (element.type !== "text") {
      return;
    }
    const { estimatedLines, maxLines } = estimateTextLines(element);
    if (estimatedLines > maxLines) {
      issues.push({
        code: "text-fit",
        message: `Text overflow estimated (${estimatedLines}/${maxLines}) (${element.id ?? `text-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function layeringChecks(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const boxes = page.elements
    .map((element, index) => toBox(element, index))
    .filter((box): box is Box => box !== null);

  for (const textBox of boxes) {
    if (textBox.element.type !== "text") {
      continue;
    }
    for (let i = textBox.elementIndex + 1; i < page.elements.length; i += 1) {
      const later = page.elements[i];
      if (later.allowTextOcclusion || !hasOpaqueFill(later)) {
        continue;
      }
      const laterBox = toBox(later, i);
      if (!laterBox || !intersects(textBox, laterBox) || overlapArea(textBox, laterBox) < 0.5) {
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
  boundaryChecks(page, issues);
  footerLaneChecks(page, options.footerTopMm, issues);
  collisionChecks(page, issues);
  textFitChecks(page, issues);
  layeringChecks(page, issues);
  return { passed: issues.length === 0, issues };
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
      s: element.stroke,
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
      b: page.meta?.brief,
      e: page.elements.map(cleanElementForSignature),
    })),
  );
}

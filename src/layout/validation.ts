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
const BOX_EPSILON = 0.05;

function intersects(a: Box, b: Box): boolean {
  return (
    a.xMm < b.xMm + b.wMm &&
    a.xMm + a.wMm > b.xMm &&
    a.yMm < b.yMm + b.hMm &&
    a.yMm + a.hMm > b.yMm
  );
}

function intersectionAreaMm2(a: Box, b: Box): number {
  const xOverlap = Math.max(0, Math.min(a.xMm + a.wMm, b.xMm + b.wMm) - Math.max(a.xMm, b.xMm));
  const yOverlap = Math.max(0, Math.min(a.yMm + a.hMm, b.yMm + b.hMm) - Math.max(a.yMm, b.yMm));
  return xOverlap * yOverlap;
}

function hasOpaqueFill(element: Element): boolean {
  if (element.type === "image") {
    return true;
  }
  if (element.type !== "rect") {
    return false;
  }
  const opacity = element.fillOpacity ?? 1;
  return opacity >= 0.75;
}

function elementToBox(element: Element, elementIndex: number): Box | null {
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

function boundaryChecks(
  page: PageLayout,
  options: ValidationOptions,
  issues: LayoutValidationIssue[],
): void {
  const pageW = PAGE_SIZE_A4_PORTRAIT.widthMm;
  const pageH = PAGE_SIZE_A4_PORTRAIT.heightMm;

  page.elements.forEach((element, index) => {
    if (element.type === "line") {
      const points = [
        { x: element.x1Mm, y: element.y1Mm },
        { x: element.x2Mm, y: element.y2Mm },
      ];
      points.forEach((point) => {
        if (
          point.x < -BOX_EPSILON ||
          point.y < -BOX_EPSILON ||
          point.x > pageW + BOX_EPSILON ||
          point.y > pageH + BOX_EPSILON
        ) {
          issues.push({
            code: "boundary",
            message: `선 요소가 페이지 경계를 벗어났습니다. (${element.id ?? `line-${index}`})`,
            elementId: element.id,
            elementIndex: index,
          });
        }
      });
      return;
    }

    const x2 = element.xMm + element.wMm;
    const y2 = element.yMm + element.hMm;
    if (
      element.xMm < -BOX_EPSILON ||
      element.yMm < -BOX_EPSILON ||
      x2 > pageW + BOX_EPSILON ||
      y2 > pageH + BOX_EPSILON
    ) {
      issues.push({
        code: "boundary",
        message: `요소가 페이지 경계를 벗어났습니다. (${element.id ?? `${element.type}-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }

    if (
      typeof options.footerTopMm === "number" &&
      element.role !== "footer" &&
      y2 > options.footerTopMm + BOX_EPSILON
    ) {
      issues.push({
        code: "boundary",
        message: `푸터 예약 영역을 침범한 요소가 있습니다. (${element.id ?? `${element.type}-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function collisionChecks(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const protectedBoxes = page.elements
    .map((element, index) => elementToBox(element, index))
    .filter((box): box is Box => box !== null)
    .filter((box) => box.element.isCollisionProtected === true);

  for (let i = 0; i < protectedBoxes.length; i += 1) {
    const left = protectedBoxes[i];
    for (let j = i + 1; j < protectedBoxes.length; j += 1) {
      const right = protectedBoxes[j];
      const leftGroup = left.element.collisionGroup;
      const rightGroup = right.element.collisionGroup;
      if (leftGroup && rightGroup && leftGroup === rightGroup) {
        continue;
      }
      if (!intersects(left, right)) {
        continue;
      }
      const overlap = intersectionAreaMm2(left, right);
      if (overlap <= 0.5) {
        continue;
      }
      issues.push({
        code: "collision",
        message: `보호 영역 충돌이 감지되었습니다. (${left.element.id ?? left.elementIndex} ↔ ${
          right.element.id ?? right.elementIndex
        })`,
        elementId: left.element.id,
        elementIndex: left.elementIndex,
      });
    }
  }
}

function minimumSizeChecks(page: PageLayout, issues: LayoutValidationIssue[]): void {
  page.elements.forEach((element, index) => {
    if (element.type === "text") {
      if (element.fontSizePt < 9) {
        issues.push({
          code: "minimum-size",
          message: `텍스트 최소 크기(9pt) 미만입니다. (${element.id ?? `text-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }
      if (element.wMm < 14 || element.hMm < 4) {
        issues.push({
          code: "minimum-size",
          message: `텍스트 박스 크기가 너무 작습니다. (${element.id ?? `text-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }
      return;
    }

    if (element.type === "rect" && (element.role === "chip" || element.role === "metric")) {
      if (element.wMm < 12 || element.hMm < 8) {
        issues.push({
          code: "minimum-size",
          message: `칩/메트릭 카드가 가독성 기준보다 작습니다. (${element.id ?? `rect-${index}`})`,
          elementId: element.id,
          elementIndex: index,
        });
      }
    }
  });
}

function estimateTextLines(element: TextElement): {
  estimatedLines: number;
  maxLines: number;
} {
  const lineHeightRatio = element.lineHeight ?? 1.25;
  const charWidthMm = Math.max(element.fontSizePt * MM_PER_PT * 0.52, 0.8);
  const charsPerLine = Math.max(1, Math.floor(element.wMm / charWidthMm));
  const sourceLines = element.text.split(/\r?\n/);

  let estimatedLines = 0;
  for (const line of sourceLines) {
    const effective = line.trim().length === 0 ? 1 : Math.ceil(line.length / charsPerLine);
    estimatedLines += Math.max(1, effective);
  }

  const lineHeightMm = element.fontSizePt * MM_PER_PT * lineHeightRatio;
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
        message: `텍스트가 박스에 비해 과다합니다. 추정 ${estimatedLines}줄 / 허용 ${maxLines}줄 (${element.id ?? `text-${index}`})`,
        elementId: element.id,
        elementIndex: index,
      });
    }
  });
}

function layeringChecks(page: PageLayout, issues: LayoutValidationIssue[]): void {
  const boxes = page.elements
    .map((element, index) => elementToBox(element, index))
    .filter((box): box is Box => box !== null);

  boxes.forEach((textBox) => {
    if (textBox.element.type !== "text") {
      return;
    }

    for (let index = textBox.elementIndex + 1; index < page.elements.length; index += 1) {
      const laterElement = page.elements[index];
      if (laterElement.allowTextOcclusion) {
        continue;
      }
      if (!hasOpaqueFill(laterElement)) {
        continue;
      }
      const laterBox = elementToBox(laterElement, index);
      if (!laterBox) {
        continue;
      }
      if (!intersects(textBox, laterBox)) {
        continue;
      }
      if (intersectionAreaMm2(textBox, laterBox) < 0.5) {
        continue;
      }
      issues.push({
        code: "layering",
        message: `텍스트가 이후 요소에 가려질 수 있습니다. (${textBox.element.id ?? `text-${textBox.elementIndex}`})`,
        elementId: textBox.element.id,
        elementIndex: textBox.elementIndex,
      });
      break;
    }
  });
}

export function validatePageLayout(
  page: PageLayout,
  options: ValidationOptions = {},
): {
  passed: boolean;
  issues: LayoutValidationIssue[];
} {
  const issues: LayoutValidationIssue[] = [];

  boundaryChecks(page, options, issues);
  collisionChecks(page, issues);
  minimumSizeChecks(page, issues);
  textFitChecks(page, issues);
  layeringChecks(page, issues);

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
      stroke: element.stroke,
      width: Number(element.widthMm.toFixed(3)),
    };
  }

  return {
    t: element.type,
    id: element.id ?? "",
    x: Number(element.xMm.toFixed(3)),
    y: Number(element.yMm.toFixed(3)),
    w: Number(element.wMm.toFixed(3)),
    h: Number(element.hMm.toFixed(3)),
    text: element.type === "text" ? element.text : undefined,
    role: element.role ?? "",
    group: element.collisionGroup ?? "",
  };
}

export function createLayoutSignature(pages: PageLayout[]): string {
  return JSON.stringify(
    pages.map((page) => ({
      pageNumber: page.pageNumber,
      brief: page.meta?.brief,
      elements: page.elements.map(cleanElementForSignature),
    })),
  );
}

import type { PageSizeSpec } from "@/src/layout/pageSize";
import { hasForbiddenEllipsis } from "@/src/layout/validation";
import type { LayoutValidationIssue, PageLayout } from "@/src/layout/types";

export type ExportAuditResult = {
  passed: boolean;
  issues: LayoutValidationIssue[];
};

function withinBounds(page: PageLayout, x: number, y: number): boolean {
  return x >= -0.05 && y >= -0.05 && x <= page.widthMm + 0.05 && y <= page.heightMm + 0.05;
}

function hasEditableObjects(page: PageLayout): boolean {
  return page.elements.some((element) => element.type === "text" || element.type === "rect" || element.type === "line");
}

export function runExportAudit(params: {
  pages: PageLayout[];
  expectedPageCount: number;
  pageSize: PageSizeSpec;
  debugEnabled: boolean;
}): ExportAuditResult {
  const issues: LayoutValidationIssue[] = [];

  if (params.debugEnabled) {
    issues.push({
      code: "export-audit",
      message: "export must run with debug=false",
    });
  }

  if (params.pages.length !== params.expectedPageCount) {
    issues.push({
      code: "export-audit",
      message: `slide count mismatch: expected ${params.expectedPageCount}, got ${params.pages.length}`,
    });
  }

  params.pages.forEach((page, pageIndex) => {
    if (Math.abs(page.widthMm - params.pageSize.widthMm) > 0.01 || Math.abs(page.heightMm - params.pageSize.heightMm) > 0.01) {
      issues.push({
        code: "export-audit",
        message: `page size mismatch on slide ${page.pageNumber}`,
        elementIndex: pageIndex,
      });
    }

    if (!hasEditableObjects(page)) {
      issues.push({
        code: "export-audit",
        message: `slide ${page.pageNumber} has no editable text/shape objects`,
        elementIndex: pageIndex,
      });
    }

    if (!params.debugEnabled && page.elements.some((element) => element.debugOnly)) {
      issues.push({
        code: "export-audit",
        message: `debug/meta element leaked into export on slide ${page.pageNumber}`,
        elementIndex: pageIndex,
      });
    }

    page.elements.forEach((element, elementIndex) => {
      if (element.type === "text" && hasForbiddenEllipsis(element.text)) {
        issues.push({
          code: "export-audit",
          message: `ellipsis/truncation marker remains on slide ${page.pageNumber}`,
          elementId: element.id,
          elementIndex,
        });
      }

      if (element.type === "line") {
        const validStart = withinBounds(page, element.x1Mm, element.y1Mm);
        const validEnd = withinBounds(page, element.x2Mm, element.y2Mm);
        if (!validStart || !validEnd) {
          issues.push({
            code: "export-audit",
            message: `line out of bounds on slide ${page.pageNumber}`,
            elementIndex,
          });
        }
        return;
      }

      const x2 = element.xMm + element.wMm;
      const y2 = element.yMm + element.hMm;
      if (!withinBounds(page, element.xMm, element.yMm) || !withinBounds(page, x2, y2)) {
        issues.push({
          code: "export-audit",
          message: `object out of bounds on slide ${page.pageNumber}`,
          elementId: element.id,
          elementIndex,
        });
      }
    });
  });

  return {
    passed: issues.length === 0,
    issues,
  };
}

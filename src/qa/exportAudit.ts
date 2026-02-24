import type { PageSizeSpec } from "@/src/layout/pageSize";
import { createLayoutSignature, hasForbiddenEllipsis } from "@/src/layout/validation";
import type { LayoutValidationIssue, PageLayout } from "@/src/layout/types";
import type { ReferenceUsageReport } from "@/src/planner/types";
import { stableHashFromParts } from "@/src/io/hash";

export type ExportGateProof = {
  requestHash: string;
  referenceIndexStatus: ReferenceUsageReport["referenceIndexStatus"];
  usedLayoutClusters: number;
  requiredLayoutClusters: number;
  themeFactoryStatus: "ran" | "skipped";
  runtimeGatesStatus: "pass" | "fail";
};

export type ExportAuditResult = {
  passed: boolean;
  issues: LayoutValidationIssue[];
  auditHash: string;
  referenceUsageReport?: ReferenceUsageReport;
  gateProof: ExportGateProof;
};

function withinBounds(page: PageLayout, x: number, y: number): boolean {
  return x >= -0.05 && y >= -0.05 && x <= page.widthMm + 0.05 && y <= page.heightMm + 0.05;
}

function hasEditableObjects(page: PageLayout): boolean {
  return page.elements.some((element) => element.type === "text" || element.type === "rect" || element.type === "line");
}

function checkReferenceUsageGate(params: {
  issues: LayoutValidationIssue[];
  report: ReferenceUsageReport;
  expectedPageCount: number;
}): void {
  if (params.report.referenceIndexStatus !== "fresh") {
    params.issues.push({
      code: "export-audit",
      message: `reference index must be fresh (got ${params.report.referenceIndexStatus})`,
    });
  }

  if (params.report.styleSource !== "references") {
    params.issues.push({
      code: "export-audit",
      message: "stylePreset.source must be references when references are required",
    });
  }

  if (params.report.layoutSource !== "references") {
    params.issues.push({
      code: "export-audit",
      message: "layoutPlan.source must be references when references are required",
    });
  }

  if (params.report.usedStyleClusterIds.length < 1) {
    params.issues.push({
      code: "export-audit",
      message: "reference usage coverage missing style clusters",
    });
  }

  const expectedCoverage = params.expectedPageCount >= 6 ? 3 : params.expectedPageCount > 1 ? 2 : 1;
  const minRequired = Math.max(params.report.minRequiredLayoutClusters, expectedCoverage);

  if (params.report.usedLayoutClusterIds.length < minRequired) {
    params.issues.push({
      code: "export-audit",
      message: `reference usage coverage insufficient layout clusters (${params.report.usedLayoutClusterIds.length}/${minRequired})`,
    });
  }

  if (params.report.selectedLayoutClusterIds.length === 0) {
    params.issues.push({
      code: "export-audit",
      message: "layout plan must declare selected layout clusters",
    });
  }
}

export function runExportAudit(params: {
  pages: PageLayout[];
  expectedPageCount: number;
  pageSize: PageSizeSpec;
  debugEnabled: boolean;
  referenceRequired: boolean;
  referenceUsageReport?: ReferenceUsageReport;
  requestHash: string;
  themeFactoryStatus: "ran" | "skipped";
  runtimeGatesPassed: boolean;
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

  if (params.referenceRequired && !params.referenceUsageReport) {
    issues.push({
      code: "export-audit",
      message: "referenceUsageReport is required when references exist",
    });
  }

  if (params.referenceRequired && params.referenceUsageReport) {
    checkReferenceUsageGate({
      issues,
      report: params.referenceUsageReport,
      expectedPageCount: params.expectedPageCount,
    });
  }

  if (!params.runtimeGatesPassed) {
    issues.push({
      code: "export-audit",
      message: "runtime gates must pass before export",
    });
  }

  const requiredLayoutClusters = params.referenceUsageReport
    ? Math.max(
        params.referenceUsageReport.minRequiredLayoutClusters,
        params.expectedPageCount >= 6 ? 3 : params.expectedPageCount > 1 ? 2 : 1,
      )
    : 0;

  const gateProof: ExportGateProof = {
    requestHash: params.requestHash,
    referenceIndexStatus: params.referenceUsageReport?.referenceIndexStatus ?? "not-required",
    usedLayoutClusters: params.referenceUsageReport?.usedLayoutClusterIds.length ?? 0,
    requiredLayoutClusters,
    themeFactoryStatus: params.themeFactoryStatus,
    runtimeGatesStatus: params.runtimeGatesPassed ? "pass" : "fail",
  };

  const payload = {
    pageSignature: createLayoutSignature(params.pages),
    expectedPageCount: params.expectedPageCount,
    pageSize: {
      widthMm: Number(params.pageSize.widthMm.toFixed(3)),
      heightMm: Number(params.pageSize.heightMm.toFixed(3)),
    },
    debugEnabled: params.debugEnabled,
    referenceUsageReport: params.referenceUsageReport ?? null,
    gateProof,
  };

  const auditHash = stableHashFromParts([JSON.stringify(payload)], 12);

  return {
    passed: issues.length === 0,
    issues,
    auditHash,
    referenceUsageReport: params.referenceUsageReport,
    gateProof,
  };
}

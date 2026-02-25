import type { LayoutValidationIssue, PageLayout, TextElement } from "@/src/layout/types";
import type { RequestDocKind } from "@/src/request/requestSpec";

type InternalTermRule = {
  token: string;
  pattern: RegExp;
};

type PageContentStats = {
  pageNumber: number;
  titles: string[];
  subtitles: string[];
  bodies: string[];
  callouts: string[];
  bulletLines: string[];
  totalChars: number;
  longestLine: number;
};

export type ContentQualityIssue = {
  pageNumber: number;
  issue: LayoutValidationIssue;
};

export type ContentQualityReport = {
  passed: boolean;
  internalTermsPassed: boolean;
  completenessPassed: boolean;
  internalTermLeakCount: number;
  completenessIssueCount: number;
  issues: ContentQualityIssue[];
};

const INTERNAL_TERM_RULES: InternalTermRule[] = [
  { token: "RequestSpec", pattern: /\brequestspec\b/iu },
  { token: "variantIndex", pattern: /\bvariantindex\b/iu },
  { token: "referenceDigest", pattern: /\breferencedigest\b/iu },
  { token: "layout", pattern: /\blayout\b/iu },
  { token: "validation", pattern: /\bvalidation\b/iu },
  { token: "theme-factory", pattern: /\btheme-factory\b/iu },
  { token: "webapp-testing", pattern: /\bwebapp-testing\b/iu },
];

function keyTextElements(page: PageLayout): TextElement[] {
  return page.elements.filter((element): element is TextElement => element.type === "text" && !element.debugOnly);
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
}

function classifyPage(page: PageLayout): PageContentStats {
  const stats: PageContentStats = {
    pageNumber: page.pageNumber,
    titles: [],
    subtitles: [],
    bodies: [],
    callouts: [],
    bulletLines: [],
    totalChars: 0,
    longestLine: 0,
  };

  for (const element of keyTextElements(page)) {
    const id = (element.id ?? "").toLowerCase();
    const lines = splitLines(element.text);
    const normalized = normalizeLine(element.text);
    const textLength = normalized.length;
    stats.totalChars += textLength;

    for (const line of lines) {
      stats.longestLine = Math.max(stats.longestLine, line.length);
      if (line.startsWith("- ")) {
        stats.bulletLines.push(line);
      }
    }

    if (id.includes("subtitle")) {
      stats.subtitles.push(normalized);
      continue;
    }
    if (id.includes("title")) {
      stats.titles.push(normalized);
      continue;
    }
    if (id.includes("callout")) {
      stats.callouts.push(normalized);
      continue;
    }
    if (id.includes("body")) {
      stats.bodies.push(normalized);
      continue;
    }

    if (element.role === "text") {
      stats.bodies.push(normalized);
    }
  }

  return stats;
}

function hasMeaningfulValue(values: string[]): boolean {
  return values.some((value) => normalizeLine(value).length >= 2);
}

function internalTermIssues(pages: PageLayout[]): ContentQualityIssue[] {
  const findings: ContentQualityIssue[] = [];

  for (const page of pages) {
    for (const element of keyTextElements(page)) {
      const source = element.text.trim();
      if (!source) {
        continue;
      }

      for (const rule of INTERNAL_TERM_RULES) {
        if (!rule.pattern.test(source)) {
          continue;
        }
        findings.push({
          pageNumber: page.pageNumber,
          issue: {
            code: "internal-term",
            message: `forbidden internal term leaked in content: ${rule.token}`,
            elementId: element.id,
          },
        });
      }
    }
  }

  return findings;
}

function completenessIssuesForPage(stats: PageContentStats, docKind: RequestDocKind): LayoutValidationIssue[] {
  const issues: LayoutValidationIssue[] = [];
  const hasTitle = hasMeaningfulValue(stats.titles);
  const hasSubtitle = hasMeaningfulValue(stats.subtitles);
  const hasBody = hasMeaningfulValue(stats.bodies);
  const hasCallout = hasMeaningfulValue(stats.callouts);
  const hasBullets = stats.bulletLines.length > 0;

  if (!hasTitle) {
    issues.push({
      code: "content-completeness",
      message: "missing required title content",
    });
  }

  if (docKind === "poster" || docKind === "poster_set") {
    if (!hasSubtitle && !hasBody && !hasCallout) {
      issues.push({
        code: "content-completeness",
        message: "poster page requires subtitle/body/callout content",
      });
    }
    if (!hasBullets && !hasCallout) {
      issues.push({
        code: "content-completeness",
        message: "poster page requires bullets or callout",
      });
    }
    const maxPosterChars = docKind === "poster_set" ? 560 : 320;
    const maxPosterLineLength = docKind === "poster_set" ? 110 : 60;

    if (stats.totalChars > maxPosterChars) {
      issues.push({
        code: "content-completeness",
        message: "poster copy exceeds concise threshold",
      });
    }
    if (stats.longestLine > maxPosterLineLength) {
      issues.push({
        code: "content-completeness",
        message: "poster line length exceeds concise threshold",
      });
    }
    return issues;
  }

  if (!hasBody && !hasCallout && !hasBullets) {
    issues.push({
      code: "content-completeness",
      message: "missing explanatory body/callout content",
    });
  }

  if (stats.totalChars < 18) {
    issues.push({
      code: "content-completeness",
      message: "content volume below minimum threshold",
    });
  }

  return issues;
}

function completenessIssues(pages: PageLayout[], docKind: RequestDocKind): ContentQualityIssue[] {
  const findings: ContentQualityIssue[] = [];

  if (docKind === "poster_set" && pages.length < 2) {
    findings.push({
      pageNumber: 1,
      issue: {
        code: "content-completeness",
        message: "poster_set requires at least 2 pages",
      },
    });
  }

  for (const page of pages) {
    const stats = classifyPage(page);
    const issues = completenessIssuesForPage(stats, docKind);
    for (const issue of issues) {
      findings.push({
        pageNumber: page.pageNumber,
        issue,
      });
    }
  }

  return findings;
}

export function runContentQualityGates(params: {
  pages: PageLayout[];
  docKind: RequestDocKind;
}): ContentQualityReport {
  const termFindings = internalTermIssues(params.pages);
  const completenessFindings = completenessIssues(params.pages, params.docKind);
  const issues = [...termFindings, ...completenessFindings];

  return {
    passed: issues.length === 0,
    internalTermsPassed: termFindings.length === 0,
    completenessPassed: completenessFindings.length === 0,
    internalTermLeakCount: termFindings.length,
    completenessIssueCount: completenessFindings.length,
    issues,
  };
}


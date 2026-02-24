import type { Browser, BrowserContext, Page } from "playwright";
import type { LayoutValidationIssue, PageLayout, RuntimePageValidation } from "@/src/layout/types";

type RuntimeValidator = {
  available: boolean;
  startupLogs: string[];
  validatePages: (pages: PageLayout[]) => Promise<{ pageResults: RuntimePageValidation[]; passed: boolean }>;
  close: () => Promise<void>;
};

type RuntimeIssuePayload = {
  code: "runtime-overflow" | "runtime-clip" | "runtime-overlap" | "runtime-truncation";
  message: string;
  elementId?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function styleBlock(): string {
  return [
    "html, body { margin: 0; padding: 0; }",
    "body { background: #f4f6fa; font-family: Arial, sans-serif; }",
    ".page-container { position: relative; overflow: hidden; background: #fff; border: 1px solid #d4dae4; }",
    ".el { position: absolute; box-sizing: border-box; }",
    ".el-text { white-space: pre-wrap; overflow: visible; text-overflow: clip; margin: 0; }",
    ".el-image { background: #e7edf6; }",
  ].join("\n");
}

function renderElementHtml(element: PageLayout["elements"][number], index: number): string {
  const id = escapeHtml(element.id ?? `el-${index}`);
  const role = escapeHtml(element.role ?? "");
  const collisionGroup = escapeHtml(element.collisionGroup ?? "");
  const protectedValue = element.isCollisionProtected ? "1" : "0";
  const debugOnly = element.debugOnly ? "1" : "0";
  const isKeyTextZone =
    element.type === "text" &&
    !element.debugOnly &&
    element.role !== "footer" &&
    element.role !== "chip" &&
    element.role !== "metric";
  const keyZone = isKeyTextZone ? "1" : "0";

  if (element.type === "line") {
    const dx = element.x2Mm - element.x1Mm;
    const dy = element.y2Mm - element.y1Mm;
    const length = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    return `<div class=\"el el-line\" data-id=\"${id}\" data-role=\"${role}\" data-group=\"${collisionGroup}\" data-protected=\"${protectedValue}\" data-debug-only=\"${debugOnly}\" style=\"left:${element.x1Mm}mm;top:${element.y1Mm - element.widthMm / 2}mm;width:${length}mm;height:${element.widthMm}mm;background:${element.stroke};transform:rotate(${angle}deg);transform-origin:0 50%;\"></div>`;
  }

  if (element.type === "rect") {
    return `<div class=\"el el-rect\" data-id=\"${id}\" data-role=\"${role}\" data-group=\"${collisionGroup}\" data-protected=\"${protectedValue}\" data-debug-only=\"${debugOnly}\" data-type=\"rect\" style=\"left:${element.xMm}mm;top:${element.yMm}mm;width:${element.wMm}mm;height:${element.hMm}mm;background:${element.fill};opacity:${element.fillOpacity ?? 1};border:${element.stroke && element.strokeWidthMm ? `${element.strokeWidthMm}mm solid ${element.stroke}` : "none"};border-radius:${element.radiusMm ?? 0}mm;\"></div>`;
  }

  if (element.type === "image") {
    return `<div class=\"el el-image\" data-id=\"${id}\" data-role=\"${role}\" data-group=\"${collisionGroup}\" data-protected=\"${protectedValue}\" data-debug-only=\"${debugOnly}\" data-type=\"image\" style=\"left:${element.xMm}mm;top:${element.yMm}mm;width:${element.wMm}mm;height:${element.hMm}mm;\"></div>`;
  }

  return `<p class=\"el el-text\" data-id=\"${id}\" data-role=\"${role}\" data-group=\"${collisionGroup}\" data-protected=\"${protectedValue}\" data-debug-only=\"${debugOnly}\" data-key-zone=\"${keyZone}\" data-type=\"text\" style=\"left:${element.xMm}mm;top:${element.yMm}mm;width:${element.wMm}mm;height:${element.hMm}mm;font-size:${element.fontSizePt}pt;line-height:${element.lineHeight ?? 1.25};font-weight:${element.bold ? 700 : 400};text-align:${element.align ?? "left"};color:${element.color ?? "#10213A"};\">${escapeHtml(element.text)}</p>`;
}

function buildPageHtml(page: PageLayout): string {
  const elementsHtml = page.elements.map((element, index) => renderElementHtml(element, index)).join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <style>${styleBlock()}</style>
</head>
<body>
  <article class=\"page-container\" id=\"page-root\" style=\"width:${page.widthMm}mm;height:${page.heightMm}mm;\">${elementsHtml}</article>
</body>
</html>`;
}

async function collectRuntimeIssues(playwrightPage: Page): Promise<RuntimeIssuePayload[]> {
  const rawResult = await playwrightPage.evaluate(() => {
    const container = document.querySelector("#page-root");
    if (!container) {
      return [
        {
          code: "runtime-clip" as const,
          message: "page root not found",
        },
      ];
    }

    const containerRect = container.getBoundingClientRect();
    const issues: Array<{
      code: "runtime-overflow" | "runtime-clip" | "runtime-overlap" | "runtime-truncation";
      message: string;
      elementId?: string;
    }> = [];

    const textNodes = Array.from(container.querySelectorAll("[data-type='text'][data-key-zone='1']"));
    for (const node of textNodes) {
      const html = node as HTMLElement;
      if (html.scrollHeight > html.clientHeight + 1 || html.scrollWidth > html.clientWidth + 1) {
        issues.push({
          code: "runtime-overflow" as const,
          message: `Text overflow detected`,
          elementId: html.dataset.id,
        });
      }

      const innerText = html.innerText.trim();
      if (innerText.includes("…") || /\.\.\.$/.test(innerText)) {
        issues.push({
          code: "runtime-truncation" as const,
          message: "Forbidden ellipsis marker detected in key text zone",
          elementId: html.dataset.id,
        });
      }

      const computed = window.getComputedStyle(html);
      const textOverflow = computed.textOverflow;
      const lineClamp = computed.getPropertyValue("line-clamp").trim();
      const webkitLineClamp = computed.getPropertyValue("-webkit-line-clamp").trim();
      const overflow = computed.overflow;
      const overflowX = computed.overflowX;
      const overflowY = computed.overflowY;
      const lineClampActive =
        (lineClamp && lineClamp !== "none" && lineClamp !== "unset" && lineClamp !== "initial" && lineClamp !== "0") ||
        (webkitLineClamp &&
          webkitLineClamp !== "none" &&
          webkitLineClamp !== "unset" &&
          webkitLineClamp !== "initial" &&
          webkitLineClamp !== "0");
      const overflowHidden = overflow === "hidden" || overflowX === "hidden" || overflowY === "hidden";
      const hasTruncationStyle = textOverflow === "ellipsis" || lineClampActive || overflowHidden;
      if (hasTruncationStyle) {
        issues.push({
          code: "runtime-truncation" as const,
          message: "Truncation style detected in key text zone",
          elementId: html.dataset.id,
        });
      }
    }

    const measuredNodes = Array.from(container.querySelectorAll(".el"));
    for (const node of measuredNodes) {
      const html = node as HTMLElement;
      const role = html.dataset.role ?? "";
      if (role === "background" || role === "decorative") {
        continue;
      }

      const rect = html.getBoundingClientRect();
      const clipped =
        rect.left < containerRect.left - 0.5 ||
        rect.top < containerRect.top - 0.5 ||
        rect.right > containerRect.right + 0.5 ||
        rect.bottom > containerRect.bottom + 0.5;

      if (clipped) {
        issues.push({
          code: "runtime-clip" as const,
          message: "Element clipped outside page container",
          elementId: html.dataset.id,
        });
      }
    }

    const protectedNodes = measuredNodes.filter((node) => (node as HTMLElement).dataset.protected === "1");
    for (let i = 0; i < protectedNodes.length; i += 1) {
      const left = protectedNodes[i] as HTMLElement;
      const leftRect = left.getBoundingClientRect();

      for (let j = i + 1; j < protectedNodes.length; j += 1) {
        const right = protectedNodes[j] as HTMLElement;
        if (left.dataset.group && right.dataset.group && left.dataset.group === right.dataset.group) {
          continue;
        }

        const rightRect = right.getBoundingClientRect();
        const w = Math.max(0, Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left));
        const h = Math.max(0, Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top));
        const area = w * h;

        if (area > 4) {
          issues.push({
            code: "runtime-overlap" as const,
            message: "Protected elements overlap",
            elementId: left.dataset.id,
          });
        }
      }
    }

    return issues;
  });

  return rawResult
    .filter((issue): issue is RuntimeIssuePayload =>
      issue.code === "runtime-overflow" ||
      issue.code === "runtime-clip" ||
      issue.code === "runtime-overlap" ||
      issue.code === "runtime-truncation",
    )
    .map((issue) => ({
      code: issue.code,
      message: issue.message,
      elementId: issue.elementId,
    }));
}

function toRuntimePageResult(pageNumber: number, issues: RuntimeIssuePayload[]): RuntimePageValidation {
  const normalizedIssues: LayoutValidationIssue[] = issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    elementId: issue.elementId,
  }));

  return {
    pageNumber,
    passed: normalizedIssues.length === 0,
    issues: normalizedIssues,
  };
}

function unavailableValidator(reason: string): RuntimeValidator {
  return {
    available: false,
    startupLogs: [reason],
    async validatePages(pages) {
      return {
        passed: false,
        pageResults: pages.map((page) => ({
          pageNumber: page.pageNumber,
          passed: false,
          issues: [
            {
              code: "runtime-clip",
              message: reason,
            },
          ],
        })),
      };
    },
    async close() {
      return;
    },
  };
}

export async function createRuntimeValidator(): Promise<RuntimeValidator> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: {
        width: 2000,
        height: 2200,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playwright runtime validation unavailable";
    return unavailableValidator(`runtime validation unavailable: ${message}`);
  }

  return {
    available: true,
    startupLogs: ["playwright runtime validator ready"],
    async validatePages(pages: PageLayout[]) {
      if (!context) {
        return {
          passed: false,
          pageResults: pages.map((page) => ({
            pageNumber: page.pageNumber,
            passed: false,
            issues: [
              {
                code: "runtime-clip",
                message: "runtime validator context missing",
              },
            ],
          })),
        };
      }

      const results: RuntimePageValidation[] = [];

      for (const page of pages) {
        const probe = await context.newPage();
        await probe.setContent(buildPageHtml(page), { waitUntil: "domcontentloaded" });
        await probe.waitForTimeout(30);
        const issues = await collectRuntimeIssues(probe);
        await probe.close();

        results.push(toRuntimePageResult(page.pageNumber, issues));
      }

      return {
        passed: results.every((result) => result.passed),
        pageResults: results,
      };
    },
    async close() {
      await context?.close();
      await browser?.close();
      context = null;
      browser = null;
    },
  };
}


import { getCurrentSessionVersion, registerRegeneration } from "@/src/io/sessionVersion";
import type { ScannedImage } from "@/src/io/scanImages";
import { buildPageBrief } from "@/src/layout/content";
import { getFallbackTemplate, type TemplateId } from "@/src/layout/templateCatalog";
import type { LayoutTokens } from "@/src/layout/tokens";
import type { LayoutValidationIssue, PageLayout } from "@/src/layout/types";
import { PAGE_SIZE_A4_PORTRAIT } from "@/src/layout/types";
import { buildTemplatePage } from "@/src/layout/templates";
import { createLayoutSignature, validatePageLayout } from "@/src/layout/validation";
import { planDocument } from "@/src/planner/documentPlanner";
import type { DocumentGoal, DocumentPlan, StoryboardItem } from "@/src/planner/types";

type GenerateIntent = "regenerate" | "export";

export type GenerateLayoutOptions = {
  docTitle?: string;
  brandOrClient?: string;
  documentGoal?: DocumentGoal;
  intent?: GenerateIntent;
  fontCount?: number;
};

export type PageValidationSummary = {
  pageNumber: number;
  passed: boolean;
  issues: LayoutValidationIssue[];
};

export type GenerateLayoutResult = {
  plan: DocumentPlan;
  storyboard: StoryboardItem[];
  pages: PageLayout[];
  logs: string[];
  validation: {
    passed: boolean;
    passedPageCount: number;
    failedPageCount: number;
    pageResults: PageValidationSummary[];
  };
  exportMeta: {
    docTitle: string;
    brandOrClient: string;
    dateYmd: string;
    version: number;
    pageCount: number;
    filename: string;
  };
};

type ResolvedPage = {
  page: PageLayout;
  issues: LayoutValidationIssue[];
  passed: boolean;
  attemptedTemplates: string[];
};

function formatDateYmd(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function sanitizeFilenamePart(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
  return cleaned.length > 0 ? cleaned : fallback;
}

function withMeta(
  resolved: ResolvedPage,
  brief: ReturnType<typeof buildPageBrief>,
): PageLayout {
  return {
    ...resolved.page,
    meta: {
      brief: {
        pageRole: brief.pageRole,
        sourceImage: brief.sourceImage,
        imageCaption: brief.imageCaption,
        topic: brief.topic,
        template: brief.template,
        templateReason: brief.templateReason,
        readingFlow: brief.readingFlow,
        maxTextBudget: brief.maxTextBudget,
      },
      validation: {
        passed: resolved.passed,
        issues: resolved.issues,
        attemptedTemplates: resolved.attemptedTemplates,
      },
    },
  };
}

function resolvePageWithFallback(
  item: StoryboardItem,
  plan: DocumentPlan,
  imageByFilename: Map<string, ScannedImage>,
  tokens: LayoutTokens,
): PageLayout {
  const attempted = new Set<TemplateId>();
  let currentTemplateId = item.templateId;
  let lastResolved: ResolvedPage | null = null;
  let lastBrief: ReturnType<typeof buildPageBrief> | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const workingItem = { ...item, templateId: currentTemplateId };
    const brief = buildPageBrief(workingItem, plan);
    const sourceImage = workingItem.primaryAssetFilename
      ? imageByFilename.get(workingItem.primaryAssetFilename) ?? null
      : null;

    const page = buildTemplatePage(sourceImage, brief, item.pageNumber, tokens, currentTemplateId);
    const footerTopMm =
      PAGE_SIZE_A4_PORTRAIT.heightMm - tokens.spacingMm.pageMargin - tokens.spacingMm.footerHeight;
    const validation = validatePageLayout(page, { footerTopMm });

    const resolved: ResolvedPage = {
      page,
      issues: validation.issues,
      passed: validation.passed,
      attemptedTemplates: [...attempted, currentTemplateId],
    };

    lastResolved = resolved;
    lastBrief = brief;

    if (validation.passed) {
      return withMeta(resolved, brief);
    }

    attempted.add(currentTemplateId);
    const fallback = getFallbackTemplate(currentTemplateId);
    if (attempted.has(fallback)) {
      break;
    }
    currentTemplateId = fallback;
  }

  if (!lastResolved || !lastBrief) {
    const fallbackBrief = buildPageBrief(item, plan);
    const fallbackPage = buildTemplatePage(
      item.primaryAssetFilename ? imageByFilename.get(item.primaryAssetFilename) ?? null : null,
      fallbackBrief,
      item.pageNumber,
      tokens,
      item.templateId,
    );
    return withMeta(
      {
        page: fallbackPage,
        issues: [
          {
            code: "determinism",
            message: "Page fallback resolution failed unexpectedly.",
          },
        ],
        passed: false,
        attemptedTemplates: [item.templateId],
      },
      fallbackBrief,
    );
  }

  return withMeta(
    {
      ...lastResolved,
      attemptedTemplates: [...attempted, currentTemplateId],
      passed: false,
    },
    lastBrief,
  );
}

function generatePagesOnce(
  storyboard: StoryboardItem[],
  plan: DocumentPlan,
  images: ScannedImage[],
  tokens: LayoutTokens,
): PageLayout[] {
  const imageByFilename = new Map(images.map((image) => [image.filename, image] as const));
  return storyboard.map((item) => resolvePageWithFallback(item, plan, imageByFilename, tokens));
}

function applyDeterminismIssue(pages: PageLayout[]): PageLayout[] {
  const issue: LayoutValidationIssue = {
    code: "determinism",
    message: "Same inputs produced different layout signatures.",
  };
  return pages.map((page) => {
    const meta = page.meta;
    if (!meta) {
      return page;
    }
    return {
      ...page,
      meta: {
        ...meta,
        validation: {
          ...meta.validation,
          passed: false,
          issues: [...meta.validation.issues, issue],
        },
      },
    };
  });
}

export function generateLayout(
  orderedImages: ScannedImage[],
  tokens: LayoutTokens,
  options: GenerateLayoutOptions = {},
): GenerateLayoutResult {
  const logs: string[] = [];
  logs.push(
    `[1] Intake: images=${orderedImages.length}, fonts=${options.fontCount ?? "n/a"}, ordering=leading-number -> mtime -> natural`,
  );

  const plannerResult = planDocument(orderedImages, {
    docTitle: options.docTitle,
    documentGoal: options.documentGoal,
  });
  logs.push(...plannerResult.logs);
  logs.push("[4.1] Page generation started from approved storyboard.");

  const firstPass = generatePagesOnce(plannerResult.storyboard, plannerResult.plan, orderedImages, tokens);
  const secondPass = generatePagesOnce(plannerResult.storyboard, plannerResult.plan, orderedImages, tokens);
  const firstSignature = createLayoutSignature(firstPass);
  const secondSignature = createLayoutSignature(secondPass);
  const pages = firstSignature === secondSignature ? firstPass : applyDeterminismIssue(firstPass);

  const pageResults: PageValidationSummary[] = pages.map((page) => ({
    pageNumber: page.pageNumber,
    passed: page.meta?.validation.passed ?? false,
    issues: page.meta?.validation.issues ?? [],
  }));
  const passedPageCount = pageResults.filter((result) => result.passed).length;
  const failedPageCount = pageResults.length - passedPageCount;

  logs.push(`[4.2] Validation completed: passed=${passedPageCount}, failed=${failedPageCount}`);
  logs.push("[5] Parity model locked: preview/pptx both render from the same layout DSL.");

  const signature = createLayoutSignature(pages);
  const intent = options.intent ?? "regenerate";
  const version = intent === "regenerate" ? registerRegeneration(signature) : getCurrentSessionVersion();
  const dateYmd = formatDateYmd(new Date());

  const docTitle = plannerResult.plan.docTitle;
  const brandOrClient = options.brandOrClient?.trim() || "WellnessBox";
  const filename = `${sanitizeFilenamePart(docTitle, "맞춤_건기식_B2B_소개서")}_${sanitizeFilenamePart(
    brandOrClient,
    "WellnessBox",
  )}_${dateYmd}_v${version}_A4_${pages.length}p.pptx`;

  logs.push(`[6] Export filename prepared: ${filename}`);

  return {
    plan: plannerResult.plan,
    storyboard: plannerResult.storyboard,
    pages,
    logs,
    validation: {
      passed: failedPageCount === 0,
      passedPageCount,
      failedPageCount,
      pageResults,
    },
    exportMeta: {
      docTitle,
      brandOrClient,
      dateYmd,
      version,
      pageCount: pages.length,
      filename,
    },
  };
}

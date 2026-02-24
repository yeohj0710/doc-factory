import type { ScannedImage } from "@/src/io/scanImages";
import {
  buildPageBrief,
  getFallbackTemplate,
  type PageBrief,
  type PageTemplateId,
} from "@/src/layout/content";
import type { LayoutTokens } from "@/src/layout/tokens";
import type { LayoutValidationIssue, PageLayout } from "@/src/layout/types";
import { PAGE_SIZE_A4_PORTRAIT } from "@/src/layout/types";
import { buildTemplatePage } from "@/src/layout/templates";
import { createLayoutSignature, validatePageLayout } from "@/src/layout/validation";

type ResolvedPage = {
  page: PageLayout;
  brief: PageBrief;
  attemptedTemplates: string[];
  issues: LayoutValidationIssue[];
  passed: boolean;
};

function buildPageOnce(
  image: ScannedImage,
  imageIndex: number,
  tokens: LayoutTokens,
  forcedTemplateId?: PageTemplateId,
): {
  page: PageLayout;
  brief: PageBrief;
  issues: LayoutValidationIssue[];
  passed: boolean;
} {
  const pageNumber = imageIndex + 1;
  const brief = buildPageBrief(image, pageNumber, imageIndex, forcedTemplateId);
  const page = buildTemplatePage(image, brief, pageNumber, tokens, brief.templateId);
  const footerTopMm =
    PAGE_SIZE_A4_PORTRAIT.heightMm - tokens.spacingMm.pageMargin - tokens.spacingMm.footerHeight;
  const validation = validatePageLayout(page, { footerTopMm });

  return {
    page,
    brief,
    issues: validation.issues,
    passed: validation.passed,
  };
}

function resolvePageWithFallback(
  image: ScannedImage,
  imageIndex: number,
  tokens: LayoutTokens,
): ResolvedPage {
  const attemptedTemplateIds = new Set<PageTemplateId>();
  const attemptedTemplates: string[] = [];
  let forcedTemplateId: PageTemplateId | undefined;
  let lastResult: ReturnType<typeof buildPageOnce> | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = buildPageOnce(image, imageIndex, tokens, forcedTemplateId);
    lastResult = result;
    attemptedTemplateIds.add(result.brief.templateId);
    attemptedTemplates.push(result.brief.template);

    if (result.passed) {
      return {
        page: result.page,
        brief: result.brief,
        attemptedTemplates,
        issues: result.issues,
        passed: true,
      };
    }

    const nextTemplateId = getFallbackTemplate(result.brief.templateId);
    if (attemptedTemplateIds.has(nextTemplateId)) {
      break;
    }
    forcedTemplateId = nextTemplateId;
  }

  if (!lastResult) {
    const fallback = buildPageOnce(image, imageIndex, tokens);
    return {
      page: fallback.page,
      brief: fallback.brief,
      attemptedTemplates: [fallback.brief.template],
      issues: fallback.issues,
      passed: fallback.passed,
    };
  }

  return {
    page: lastResult.page,
    brief: lastResult.brief,
    attemptedTemplates,
    issues: lastResult.issues,
    passed: false,
  };
}

function withMeta(resolvedPage: ResolvedPage): PageLayout {
  const briefSummary = {
    sourceImage: resolvedPage.brief.sourceImage,
    imageCaption: resolvedPage.brief.imageCaption,
    category: resolvedPage.brief.category,
    template: resolvedPage.brief.template,
    templateReason: resolvedPage.brief.templateReason,
    readingFlow: resolvedPage.brief.readingFlow,
    maxTextBudget: resolvedPage.brief.maxTextBudget,
  };

  return {
    ...resolvedPage.page,
    meta: {
      brief: briefSummary,
      validation: {
        passed: resolvedPage.passed,
        issues: resolvedPage.issues,
        attemptedTemplates: resolvedPage.attemptedTemplates,
      },
    },
  };
}

function buildAllPages(orderedImages: ScannedImage[], tokens: LayoutTokens): PageLayout[] {
  return orderedImages.map((image, index) => withMeta(resolvePageWithFallback(image, index, tokens)));
}

function applyDeterminismIssue(pages: PageLayout[]): PageLayout[] {
  const issue: LayoutValidationIssue = {
    code: "determinism",
    message: "동일 입력에서 레이아웃 구조가 일치하지 않았습니다.",
  };

  return pages.map((page) => {
    const currentMeta = page.meta;
    if (!currentMeta) {
      return page;
    }
    return {
      ...page,
      meta: {
        ...currentMeta,
        validation: {
          ...currentMeta.validation,
          passed: false,
          issues: [...currentMeta.validation.issues, issue],
        },
      },
    };
  });
}

export function generateLayout(orderedImages: ScannedImage[], tokens: LayoutTokens): PageLayout[] {
  const firstPass = buildAllPages(orderedImages, tokens);
  const secondPass = buildAllPages(orderedImages, tokens);
  const firstSignature = createLayoutSignature(firstPass);
  const secondSignature = createLayoutSignature(secondPass);

  if (firstSignature !== secondSignature) {
    return applyDeterminismIssue(firstPass);
  }

  return firstPass;
}

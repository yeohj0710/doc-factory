import { getStylePresetById } from "@/src/layout/stylePresets";
import { buildPageBrief } from "@/src/layout/content";
import { getTemplateFallbackChain, type TemplateId } from "@/src/layout/templateCatalog";
import { createLayoutTokens, type LayoutTokens } from "@/src/layout/tokens";
import { buildTemplatePage } from "@/src/layout/templates";
import { createLayoutSignature, validatePageLayout } from "@/src/layout/validation";
import type { DocType, LayoutDocument, LayoutValidationIssue, PageLayout } from "@/src/layout/types";
import type { PageSizePreset } from "@/src/layout/pageSize";
import type { ScannedFont } from "@/src/io/scanFonts";
import type { ScannedImage } from "@/src/io/scanImages";
import { planDocument } from "@/src/planner/documentPlanner";
import type { DocumentPlan, StoryboardItem } from "@/src/planner/types";
import { runExportAudit } from "@/src/qa/exportAudit";
import { createRuntimeValidator } from "@/src/qa/runtimeValidation";
import { writeGeneratedLayoutArtifact } from "@/src/qa/writeGeneratedLayout";

type GenerateIntent = "regenerate" | "export";

export type GenerateLayoutOptions = {
  docTitle?: string;
  requestedDocType?: DocType;
  requestedPageSizePreset?: PageSizePreset;
  customPageSizeMm?: {
    widthMm: number;
    heightMm: number;
  };
  requestedStylePresetId?: string;
  variantIndex: number;
  seed?: number;
  intent?: GenerateIntent;
  rootDir?: string;
};

export type PageValidationSummary = {
  pageNumber: number;
  passed: boolean;
  issues: LayoutValidationIssue[];
  attemptedTemplates: string[];
};

export type GenerateLayoutResult = {
  plan: DocumentPlan;
  storyboard: StoryboardItem[];
  tokens: LayoutTokens;
  pages: PageLayout[];
  logs: string[];
  validation: {
    passed: boolean;
    passedPageCount: number;
    failedPageCount: number;
    pageResults: PageValidationSummary[];
  };
  exportAudit: {
    passed: boolean;
    issues: LayoutValidationIssue[];
  };
  exportMeta: {
    docTitle: string;
    pageSize: string;
    dateYmd: string;
    variantIndex: number;
    pageCount: number;
    filename: string;
  };
};

type AttemptState = {
  templateIndex: number;
  copyTightness: number;
  compactLevel: number;
};

type AttemptResult = {
  page: PageLayout;
  brief: ReturnType<typeof buildPageBrief>;
  staticIssues: LayoutValidationIssue[];
  runtimeIssues: LayoutValidationIssue[];
  passed: boolean;
  templateId: TemplateId;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function computeSeed(images: ScannedImage[], variantIndex: number): number {
  const fingerprint = images
    .map((image) => `${image.filename}:${Math.round(image.mtimeMs)}:${image.widthPx ?? 0}x${image.heightPx ?? 0}`)
    .join("|");
  return hashString(`${fingerprint}|v${variantIndex}`);
}

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

function mergeIssues(
  staticIssues: LayoutValidationIssue[],
  runtimeIssues: LayoutValidationIssue[],
): LayoutValidationIssue[] {
  return [...staticIssues, ...runtimeIssues];
}

function clonePageWithMeta(params: {
  attempt: AttemptResult;
  item: StoryboardItem;
  attemptedTemplates: TemplateId[];
}): PageLayout {
  const issues = mergeIssues(params.attempt.staticIssues, params.attempt.runtimeIssues);

  return {
    ...params.attempt.page,
    meta: {
      brief: {
        pageRole: params.attempt.brief.pageRole,
        sourceImage: params.attempt.brief.sourceImage,
        imageCaption: params.attempt.brief.imageCaption,
        topic: params.attempt.brief.topic,
        template: params.attempt.brief.template,
        templateReason: params.attempt.brief.templateReason,
        readingFlow: params.attempt.brief.readingFlow,
        maxTextBudget: params.attempt.brief.maxTextBudget,
        copyPipelineLog: params.attempt.brief.copyPipelineLog,
      },
      validation: {
        passed: params.attempt.passed,
        issues,
        attemptedTemplates: params.attemptedTemplates,
        runtimeIssues: params.attempt.runtimeIssues,
      },
    },
    templateId: params.attempt.templateId,
    pageRole: params.item.role,
  };
}

function nextAttemptState(state: AttemptState, issues: LayoutValidationIssue[], chainLength: number): AttemptState {
  const hasOverflowLikeIssue = issues.some((issue) =>
    ["min-size", "reserved-lane", "runtime-overflow", "runtime-clip"].includes(issue.code),
  );

  if (hasOverflowLikeIssue && state.copyTightness < 2) {
    return {
      ...state,
      copyTightness: state.copyTightness + 1,
    };
  }

  if (hasOverflowLikeIssue && state.compactLevel < 2) {
    return {
      ...state,
      compactLevel: state.compactLevel + 1,
    };
  }

  if (state.templateIndex < chainLength - 1) {
    return {
      templateIndex: state.templateIndex + 1,
      copyTightness: 0,
      compactLevel: 0,
    };
  }

  return {
    ...state,
    copyTightness: Math.min(2, state.copyTightness + 1),
    compactLevel: Math.min(2, state.compactLevel + 1),
  };
}

async function runAttempt(params: {
  item: StoryboardItem;
  plan: DocumentPlan;
  templateId: TemplateId;
  copyTightness: number;
  compactLevel: number;
  tokens: LayoutTokens;
  imageByFilename: Map<string, ScannedImage>;
  runtimeValidator: Awaited<ReturnType<typeof createRuntimeValidator>>;
}): Promise<AttemptResult> {
  const sourceImage = params.item.primaryAssetFilename
    ? params.imageByFilename.get(params.item.primaryAssetFilename) ?? null
    : null;

  const brief = buildPageBrief({
    item: params.item,
    plan: params.plan,
    templateId: params.templateId,
    copyTightness: params.copyTightness,
    tokens: params.tokens,
  });

  const page = buildTemplatePage({
    sourceImage,
    brief,
    pageNumber: params.item.pageNumber,
    tokens: params.tokens,
    templateId: params.templateId,
    pageWidthMm: params.plan.pageSize.widthMm,
    pageHeightMm: params.plan.pageSize.heightMm,
    compactLevel: params.compactLevel,
  });

  const headerBottomMm =
    params.tokens.spacingMm.pageMargin + params.tokens.spacingMm.headerHeight;
  const footerTopMm =
    params.plan.pageSize.heightMm - params.tokens.spacingMm.pageMargin - params.tokens.spacingMm.footerHeight;

  const staticValidation = validatePageLayout(page, {
    headerBottomMm,
    footerTopMm,
    minBodyFontPt: 9,
  });

  const runtimeValidation = await params.runtimeValidator.validatePages([page]);
  const runtimeIssues = runtimeValidation.pageResults[0]?.issues ?? [];

  const passed = staticValidation.passed && runtimeIssues.length === 0;

  return {
    page,
    brief,
    staticIssues: staticValidation.issues,
    runtimeIssues,
    passed,
    templateId: params.templateId,
  };
}

async function resolvePageWithAutofix(params: {
  item: StoryboardItem;
  plan: DocumentPlan;
  tokens: LayoutTokens;
  imageByFilename: Map<string, ScannedImage>;
  runtimeValidator: Awaited<ReturnType<typeof createRuntimeValidator>>;
  logs: string[];
}): Promise<PageLayout> {
  const templateChain = getTemplateFallbackChain(params.item.templateId);
  const attemptedTemplates: TemplateId[] = [];

  let state: AttemptState = {
    templateIndex: 0,
    copyTightness: 0,
    compactLevel: 0,
  };

  let lastAttempt: AttemptResult | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const templateId = templateChain[Math.min(state.templateIndex, templateChain.length - 1)] ?? "TEXT_ONLY_EDITORIAL";
    attemptedTemplates.push(templateId);

    const result = await runAttempt({
      item: params.item,
      plan: params.plan,
      templateId,
      copyTightness: state.copyTightness,
      compactLevel: state.compactLevel,
      tokens: params.tokens,
      imageByFilename: params.imageByFilename,
      runtimeValidator: params.runtimeValidator,
    });

    lastAttempt = result;

    if (result.passed) {
      if (attempt > 0) {
        params.logs.push(
          `[autofix] page ${params.item.pageNumber} resolved on attempt ${attempt + 1} (template=${templateId}, tighten=${state.copyTightness}, compact=${state.compactLevel})`,
        );
      }
      return clonePageWithMeta({
        attempt: result,
        item: params.item,
        attemptedTemplates,
      });
    }

    const mergedIssues = mergeIssues(result.staticIssues, result.runtimeIssues);
    state = nextAttemptState(state, mergedIssues, templateChain.length);
  }

  if (!lastAttempt) {
    throw new Error(`failed to build page ${params.item.pageNumber}`);
  }

  params.logs.push(
    `[autofix] page ${params.item.pageNumber} unresolved after max attempts (template=${lastAttempt.templateId})`,
  );

  return clonePageWithMeta({
    attempt: {
      ...lastAttempt,
      passed: false,
    },
    item: params.item,
    attemptedTemplates,
  });
}

function enforceDeterminismSignature(params: {
  pages: PageLayout[];
}): { pages: PageLayout[]; passed: boolean } {
  const firstSignature = createLayoutSignature(params.pages);
  const reconstructed = params.pages.map((page) => ({
    ...page,
    elements: [...page.elements],
  }));
  const secondSignature = createLayoutSignature(reconstructed);

  if (firstSignature === secondSignature) {
    return {
      pages: params.pages,
      passed: true,
    };
  }

  const determinismIssue: LayoutValidationIssue = {
    code: "determinism",
    message: "same params produced a different DSL signature",
  };

  const nextPages = params.pages.map((page) => {
    if (!page.meta) {
      return page;
    }

    return {
      ...page,
      meta: {
        ...page.meta,
        validation: {
          ...page.meta.validation,
          passed: false,
          issues: [...page.meta.validation.issues, determinismIssue],
        },
      },
    };
  });

  return {
    pages: nextPages,
    passed: false,
  };
}

export async function generateLayout(
  orderedImages: ScannedImage[],
  fonts: ScannedFont[],
  options: GenerateLayoutOptions,
): Promise<GenerateLayoutResult> {
  const logs: string[] = [];

  const variantIndex = Math.max(1, options.variantIndex || 1);
  const seed = options.seed ?? computeSeed(orderedImages, variantIndex);

  logs.push(
    `[intake] images=${orderedImages.length} fonts=${fonts.length} variantIndex=${variantIndex} seed=${seed}`,
  );

  const plannerResult = await planDocument(orderedImages, {
    docTitle: options.docTitle,
    requestedDocType: options.requestedDocType,
    requestedPageSizePreset: options.requestedPageSizePreset,
    customPageSizeMm: options.customPageSizeMm,
    requestedStylePresetId: options.requestedStylePresetId,
    variantIndex,
    seed,
    rootDir: options.rootDir,
  });

  logs.push(...plannerResult.logs);

  const preset = getStylePresetById(plannerResult.plan.stylePresetId);
  const tokens = createLayoutTokens(fonts, preset);

  logs.push(`[style] applied preset=${preset.id} (${preset.label})`);

  const imageByFilename = new Map(orderedImages.map((image) => [image.filename, image] as const));

  const runtimeValidator = await createRuntimeValidator();
  logs.push(...runtimeValidator.startupLogs.map((line) => `[runtime] ${line}`));

  const pages: PageLayout[] = [];

  for (const item of plannerResult.storyboard) {
    const resolved = await resolvePageWithAutofix({
      item,
      plan: plannerResult.plan,
      tokens,
      imageByFilename,
      runtimeValidator,
      logs,
    });
    pages.push(resolved);
  }

  await runtimeValidator.close();

  const deterministic = enforceDeterminismSignature({
    pages,
  });

  if (!deterministic.passed) {
    logs.push("[determinism] signature mismatch detected and marked as failure");
  }

  const pageResults: PageValidationSummary[] = deterministic.pages.map((page) => {
    const passed = page.meta?.validation.passed ?? false;
    return {
      pageNumber: page.pageNumber,
      passed,
      issues: page.meta?.validation.issues ?? [],
      attemptedTemplates: page.meta?.validation.attemptedTemplates ?? [page.templateId],
    };
  });

  const passedPageCount = pageResults.filter((result) => result.passed).length;
  const failedPageCount = pageResults.length - passedPageCount;

  logs.push(`[validation] static+runtime passed=${passedPageCount}/${deterministic.pages.length}`);

  const exportAudit = runExportAudit({
    pages: deterministic.pages,
    expectedPageCount: plannerResult.plan.pageCount,
    pageSize: plannerResult.plan.pageSize,
  });

  if (!exportAudit.passed) {
    logs.push(`[audit] export audit failed (${exportAudit.issues.length} issues)`);
  } else {
    logs.push("[audit] export audit passed");
  }

  const dateYmd = formatDateYmd(new Date());
  const filename = `${sanitizeFilenamePart(plannerResult.plan.docTitle, "Visual_Document")}_${plannerResult.plan.pageSizePreset}_${dateYmd}_v${variantIndex}_${deterministic.pages.length}p.pptx`;

  logs.push(`[export] filename=${filename}`);

  const documentArtifact: LayoutDocument = {
    params: {
      pageSizePreset: plannerResult.plan.pageSizePreset,
      customPageSize: plannerResult.plan.pageSizePreset === "CUSTOM"
        ? {
            widthMm: plannerResult.plan.pageSize.widthMm,
            heightMm: plannerResult.plan.pageSize.heightMm,
          }
        : undefined,
      docType: plannerResult.plan.docType,
      stylePresetId: plannerResult.plan.stylePresetId,
      variantIndex,
      seed,
    },
    pages: deterministic.pages,
  };

  try {
    await writeGeneratedLayoutArtifact(documentArtifact, options.rootDir ?? process.cwd());
    logs.push("[artifact] src/generated/layout.json updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logs.push(`[artifact] failed to write generated layout: ${message}`);
  }

  return {
    plan: plannerResult.plan,
    storyboard: plannerResult.storyboard,
    tokens,
    pages: deterministic.pages,
    logs,
    validation: {
      passed: failedPageCount === 0,
      passedPageCount,
      failedPageCount,
      pageResults,
    },
    exportAudit,
    exportMeta: {
      docTitle: plannerResult.plan.docTitle,
      pageSize: plannerResult.plan.pageSizePreset,
      dateYmd,
      variantIndex,
      pageCount: deterministic.pages.length,
      filename,
    },
  };
}

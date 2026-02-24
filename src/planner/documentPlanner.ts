import { promises as fs } from "node:fs";
import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";
import { ensureReferenceIndex, type ReferenceIndexContext } from "@/src/io/referenceIndex";
import { resolvePageSize } from "@/src/layout/pageSize";
import { getStylePresetById, selectStylePreset } from "@/src/layout/stylePresets";
import {
  getTemplateSpec,
  isFullBleedTemplate,
  templateSupportsImage,
  type TemplateId,
} from "@/src/layout/templateCatalog";
import {
  mapRequestDocKindToDocType,
  resolveRequestedPageCount,
  type RequestSpec,
} from "@/src/request/requestSpec";
import type { DocType } from "@/src/layout/types";
import {
  selectBuiltinLayoutPlan,
  selectReferenceLayoutPlan,
  selectReferenceStylePreset,
} from "@/src/planner/referenceDriven";
import type {
  AssetTopic,
  DocumentPlan,
  PageRole,
  PlannerResult,
  StoryboardItem,
  ThemeFactoryProof,
  TopicCluster,
} from "@/src/planner/types";

type PlanOptions = {
  requestSpec: RequestSpec;
  requestHash: string;
  intent?: "regenerate" | "export";
  rootDir?: string;
  disableReferenceDrivenPlanning?: boolean;
  referenceContext?: ReferenceIndexContext;
};

type TopicDetection = {
  topic: AssetTopic;
  isLowSignal: boolean;
  isProofAsset: boolean;
};

type RoleSequencePlan = {
  roles: PageRole[];
  rhythmId: string;
};

const RHYTHM_IDS = ["editorial", "visual", "evidence", "narrative"] as const;

const TOPIC_KEYWORDS: Record<AssetTopic, string[]> = {
  ui: ["ui", "screen", "dashboard", "app", "web", "mock", "wireframe", "화면"],
  photo: ["photo", "product", "package", "shot", "render", "제품", "패키지", "상품"],
  chart: ["chart", "graph", "table", "report", "metric", "kpi", "리포트", "차트"],
  diagram: ["diagram", "flow", "map", "icon", "schema", "timeline", "프로세스", "흐름"],
  people: ["people", "person", "team", "meeting", "lifestyle", "사람", "회의", "팀"],
  generic: [],
};

const ROLE_TEMPLATE_POOL: Record<PageRole, TemplateId[]> = {
  cover: ["COVER_HERO_BAND", "COVER_SPLIT_MEDIA", "TITLE_MEDIA_SAFE"],
  "section-divider": ["SECTION_DIVIDER", "QUOTE_FOCUS", "TEXT_ONLY_EDITORIAL"],
  agenda: ["AGENDA_EDITORIAL", "TEXT_ONLY_EDITORIAL", "QUOTE_FOCUS"],
  insight: ["TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT", "TEXT_ONLY_EDITORIAL"],
  solution: ["TWO_COLUMN_MEDIA_TEXT", "TITLE_MEDIA_SAFE", "COMPARISON_TABLE"],
  process: ["PROCESS_FLOW", "TIMELINE_STEPS", "TEXT_ONLY_EDITORIAL"],
  timeline: ["TIMELINE_STEPS", "PROCESS_FLOW", "COMPARISON_TABLE"],
  metrics: ["METRICS_GRID", "COMPARISON_TABLE", "TITLE_MEDIA_SAFE"],
  comparison: ["COMPARISON_TABLE", "METRICS_GRID", "TEXT_ONLY_EDITORIAL"],
  gallery: ["GALLERY_SINGLE", "TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT"],
  "text-only": ["TEXT_ONLY_EDITORIAL", "QUOTE_FOCUS", "AGENDA_EDITORIAL"],
  cta: ["CTA_CONTACT", "QUOTE_FOCUS", "TEXT_ONLY_EDITORIAL"],
  topic: ["TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT", "GALLERY_SINGLE"],
};

const ROLE_TOPIC_PRIORITY: Record<PageRole, AssetTopic[]> = {
  cover: ["photo", "ui", "chart", "diagram", "generic", "people"],
  "section-divider": ["generic", "ui", "photo", "chart", "diagram", "people"],
  agenda: ["generic", "chart", "ui", "diagram", "photo", "people"],
  insight: ["chart", "ui", "diagram", "photo", "generic", "people"],
  solution: ["ui", "diagram", "photo", "chart", "generic", "people"],
  process: ["diagram", "ui", "chart", "photo", "generic", "people"],
  timeline: ["diagram", "chart", "ui", "photo", "generic", "people"],
  metrics: ["chart", "ui", "diagram", "photo", "generic", "people"],
  comparison: ["chart", "diagram", "ui", "photo", "generic", "people"],
  gallery: ["photo", "ui", "chart", "diagram", "generic", "people"],
  "text-only": ["generic", "chart", "ui", "diagram", "photo", "people"],
  cta: ["generic", "chart", "ui", "diagram", "photo", "people"],
  topic: ["ui", "photo", "chart", "diagram", "generic", "people"],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s_.\-()/\\]+/g, "");
}

function createRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pickOne<T>(list: readonly T[], rng: () => number, offset = 0): T {
  const index = Math.floor(rng() * list.length + offset) % list.length;
  return list[index] as T;
}

function rotateList<T>(items: readonly T[], shift: number): T[] {
  if (items.length <= 1) {
    return [...items];
  }
  const safeShift = ((shift % items.length) + items.length) % items.length;
  return [...items.slice(safeShift), ...items.slice(0, safeShift)];
}

function detectTopic(image: ScannedImage): TopicDetection {
  const name = normalize(image.filename);
  const aspect =
    image.widthPx && image.heightPx && image.heightPx > 0
      ? image.widthPx / image.heightPx
      : 1;

  if (TOPIC_KEYWORDS.chart.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "chart", isLowSignal: false, isProofAsset: true };
  }
  if (TOPIC_KEYWORDS.ui.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "ui", isLowSignal: false, isProofAsset: true };
  }
  if (TOPIC_KEYWORDS.diagram.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "diagram", isLowSignal: false, isProofAsset: true };
  }
  if (TOPIC_KEYWORDS.people.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "people", isLowSignal: true, isProofAsset: false };
  }
  if (TOPIC_KEYWORDS.photo.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "photo", isLowSignal: false, isProofAsset: false };
  }

  if (aspect > 1.45) {
    return { topic: "ui", isLowSignal: false, isProofAsset: true };
  }
  if (aspect < 0.78) {
    return { topic: "photo", isLowSignal: false, isProofAsset: false };
  }

  return { topic: "generic", isLowSignal: false, isProofAsset: false };
}

function buildTopicClusters(images: ScannedImage[]): {
  clusters: TopicCluster[];
  topicByFilename: Map<string, TopicDetection>;
  proofAssetCount: number;
  lowSignalAssetCount: number;
} {
  const topicByFilename = new Map<string, TopicDetection>();
  const grouped = new Map<AssetTopic, ScannedImage[]>();

  let proofAssetCount = 0;
  let lowSignalAssetCount = 0;

  for (const image of images) {
    const topic = detectTopic(image);
    topicByFilename.set(image.filename, topic);

    const bucket = grouped.get(topic.topic) ?? [];
    bucket.push(image);
    grouped.set(topic.topic, bucket);

    if (topic.isProofAsset) {
      proofAssetCount += 1;
    }
    if (topic.isLowSignal) {
      lowSignalAssetCount += 1;
    }
  }

  const clusters: TopicCluster[] = [...grouped.entries()].map(([topic, bucket]) => ({
    topic,
    images: bucket,
    lowSignalCount: bucket.filter((image) => topicByFilename.get(image.filename)?.isLowSignal).length,
  }));

  clusters.sort((a, b) => b.images.length - a.images.length || a.topic.localeCompare(b.topic));

  return {
    clusters,
    topicByFilename,
    proofAssetCount,
    lowSignalAssetCount,
  };
}

function decideFallbackPageCount(params: {
  docType: DocType;
  imageCount: number;
  topicCount: number;
  proofAssetCount: number;
  lowSignalAssetCount: number;
}): number {
  if (params.docType === "poster") {
    return 1;
  }
  if (params.docType === "one-pager") {
    return params.imageCount <= 0 ? 1 : 2;
  }

  const lowSignalPenalty = params.lowSignalAssetCount > Math.floor(params.imageCount / 2) ? 1 : 0;

  if (params.docType === "multi-card") {
    return Math.max(4, Math.min(12, 4 + params.topicCount + Math.floor(params.imageCount / 3) - lowSignalPenalty));
  }

  if (params.docType === "report") {
    return Math.max(6, Math.min(14, 6 + params.topicCount + Math.floor(params.proofAssetCount / 2) - lowSignalPenalty));
  }

  return Math.max(4, Math.min(10, 5 + params.topicCount + Math.floor(params.imageCount / 4) - lowSignalPenalty));
}

function baseSequencesByDocType(docType: DocType): PageRole[][] {
  if (docType === "report") {
    return [
      ["cover", "agenda", "metrics", "comparison", "process", "text-only", "cta"],
      ["cover", "section-divider", "metrics", "timeline", "comparison", "text-only", "cta"],
      ["cover", "agenda", "insight", "metrics", "timeline", "text-only", "cta"],
      ["cover", "topic", "comparison", "metrics", "process", "text-only", "cta"],
    ];
  }

  if (docType === "multi-card") {
    return [
      ["cover", "topic", "gallery", "topic", "metrics", "text-only", "cta"],
      ["cover", "gallery", "topic", "section-divider", "comparison", "text-only", "cta"],
      ["cover", "topic", "process", "gallery", "timeline", "text-only", "cta"],
      ["cover", "section-divider", "topic", "comparison", "gallery", "text-only", "cta"],
    ];
  }

  return [
    ["cover", "agenda", "insight", "solution", "process", "text-only", "cta"],
    ["cover", "section-divider", "solution", "metrics", "process", "text-only", "cta"],
    ["cover", "topic", "insight", "comparison", "timeline", "text-only", "cta"],
    ["cover", "gallery", "solution", "process", "comparison", "text-only", "cta"],
  ];
}

function extraPoolByDocType(docType: DocType): PageRole[] {
  if (docType === "report") {
    return ["metrics", "comparison", "timeline", "insight", "section-divider", "process"];
  }

  if (docType === "multi-card") {
    return ["topic", "gallery", "comparison", "process", "section-divider", "timeline"];
  }

  return ["insight", "solution", "metrics", "timeline", "section-divider", "topic"];
}

function normalizeRoleSequence(sequence: PageRole[], enforceCta: boolean): PageRole[] {
  if (sequence.length === 0) {
    return [];
  }

  const next = [...sequence];
  next[0] = "cover";
  if (enforceCta && next.length > 1) {
    next[next.length - 1] = "cta";
  }
  return next;
}

function buildRoleSequence(params: {
  docType: DocType;
  pageCount: number;
  seed: number;
  variantIndex: number;
}): RoleSequencePlan {
  if (params.docType === "poster") {
    return {
      roles: ["cover"],
      rhythmId: "single-poster",
    };
  }

  if (params.docType === "one-pager") {
    return {
      roles: params.pageCount <= 1 ? ["cover"] : ["cover", "text-only"],
      rhythmId: "single-sheet",
    };
  }

  const baseVariants = baseSequencesByDocType(params.docType);
  const rhythmIndex = Math.abs(params.seed + params.variantIndex * 31) % baseVariants.length;
  const rhythmId = RHYTHM_IDS[rhythmIndex] ?? `rhythm-${rhythmIndex + 1}`;
  const base = baseVariants[rhythmIndex] ?? baseVariants[0] ?? ["cover", "text-only", "cta"];

  if (params.pageCount <= base.length) {
    return {
      roles: normalizeRoleSequence(base.slice(0, params.pageCount), base.includes("cta")),
      rhythmId,
    };
  }

  const extrasNeeded = params.pageCount - base.length;
  const extras = rotateList(extraPoolByDocType(params.docType), rhythmIndex);
  const next = [...base];

  for (let index = 0; index < extrasNeeded; index += 1) {
    const role = extras[index % extras.length] as PageRole;
    const ctaIndex = next.lastIndexOf("cta");
    const insertAt = ctaIndex > 0 ? ctaIndex : next.length;
    next.splice(insertAt, 0, role);
  }

  return {
    roles: normalizeRoleSequence(next.slice(0, params.pageCount), base.includes("cta")),
    rhythmId,
  };
}

function successCriteria(role: PageRole): string {
  if (role === "cover") return "Document purpose is clear in 5 seconds.";
  if (role === "section-divider") return "Section transition is visually clear.";
  if (role === "agenda") return "Flow and order of topics is obvious.";
  if (role === "insight") return "Evidence and insight are linked.";
  if (role === "solution") return "Execution responsibility is explicit.";
  if (role === "process") return "Process outputs are complete.";
  if (role === "timeline") return "Milestones and schedule are readable.";
  if (role === "metrics") return "At least three measurable signals are shown.";
  if (role === "comparison") return "Option differences are explicit.";
  if (role === "gallery") return "Image placement supports message delivery.";
  if (role === "text-only") return "Message remains clear without image.";
  if (role === "cta") return "Next action can be decided immediately.";
  return "Topic signal is clear and concise.";
}

function templateForRole(params: {
  role: PageRole;
  hasAsset: boolean;
  rng: () => number;
  preferredTemplateIds?: TemplateId[];
  excludeTemplateId?: TemplateId;
  preferNonFullBleed?: boolean;
  templateShift?: number;
}): TemplateId {
  const pool = ROLE_TEMPLATE_POOL[params.role] ?? ROLE_TEMPLATE_POOL.topic;
  const preferred = params.preferredTemplateIds ?? [];
  const mergedPool: TemplateId[] = [];

  for (const preferredTemplate of preferred) {
    if (pool.includes(preferredTemplate) && !mergedPool.includes(preferredTemplate)) {
      mergedPool.push(preferredTemplate);
    }
  }
  for (const templateId of pool) {
    if (!mergedPool.includes(templateId)) {
      mergedPool.push(templateId);
    }
  }

  const candidates = mergedPool.filter((templateId) => {
    if (params.excludeTemplateId && templateId === params.excludeTemplateId) {
      return false;
    }
    if (!templateSupportsImage(templateId, params.hasAsset)) {
      return false;
    }
    if (params.preferNonFullBleed && isFullBleedTemplate(templateId)) {
      return false;
    }
    return true;
  });

  if (candidates.length > 0) {
    return pickOne(candidates, params.rng, params.templateShift ?? 0);
  }

  const fallback = mergedPool.find((templateId) => templateSupportsImage(templateId, params.hasAsset));
  if (fallback) {
    return fallback;
  }

  return "TEXT_ONLY_EDITORIAL";
}

function requiresAsset(role: PageRole): boolean {
  return role === "cover" || role === "gallery";
}

function optionalAsset(role: PageRole): boolean {
  return role === "insight" || role === "solution" || role === "metrics" || role === "topic";
}

function takeAsset(params: {
  pools: Map<AssetTopic, ScannedImage[]>;
  topicByFilename: Map<string, TopicDetection>;
  preferredTopics: AssetTopic[];
  required: boolean;
}): ScannedImage | null {
  const tryTake = (topics: AssetTopic[], includeLowSignal: boolean): ScannedImage | null => {
    for (const topic of topics) {
      const bucket = params.pools.get(topic) ?? [];
      const index = bucket.findIndex((image) => {
        const isLowSignal = params.topicByFilename.get(image.filename)?.isLowSignal ?? false;
        return includeLowSignal || !isLowSignal;
      });

      if (index >= 0) {
        const [picked] = bucket.splice(index, 1);
        params.pools.set(topic, bucket);
        return picked ?? null;
      }
    }
    return null;
  };

  const preferred = tryTake(params.preferredTopics, false);
  if (preferred) {
    return preferred;
  }

  const allTopics: AssetTopic[] = ["ui", "photo", "chart", "diagram", "generic", "people"];
  const fallback = tryTake(allTopics, false);
  if (fallback) {
    return fallback;
  }

  if (!params.required) {
    return null;
  }

  return tryTake(allTopics, true);
}

function ensureDiversity(storyboard: StoryboardItem[], rng: () => number, variantIndex: number): StoryboardItem[] {
  const next = [...storyboard];

  for (let index = 2; index < next.length; index += 1) {
    const a = next[index - 2];
    const b = next[index - 1];
    const c = next[index];
    if (!a || !b || !c) {
      continue;
    }
    if (a.templateId === b.templateId && b.templateId === c.templateId) {
      const replacement = templateForRole({
        role: c.role,
        hasAsset: c.primaryAssetFilename !== null,
        preferredTemplateIds: c.templatePreferenceIds,
        excludeTemplateId: c.templateId,
        templateShift: variantIndex * 11 + index * 3,
        rng,
      });
      const spec = getTemplateSpec(replacement);
      next[index] = {
        ...c,
        templateId: replacement,
        copyBudget: spec.maxTextBudget,
        isTextOnly: spec.imagePolicy === "none" || c.primaryAssetFilename === null,
        isFullBleed: spec.isFullBleed,
      };
    }
  }

  const fullBleedLimit = Math.max(1, Math.floor(next.length * 0.4));
  let fullBleedCount = next.filter((item) => item.isFullBleed).length;
  if (fullBleedCount > fullBleedLimit) {
    for (let index = 0; index < next.length && fullBleedCount > fullBleedLimit; index += 1) {
      const item = next[index];
      if (!item || !item.isFullBleed) {
        continue;
      }
      const replacement = templateForRole({
        role: item.role,
        hasAsset: item.primaryAssetFilename !== null,
        preferredTemplateIds: item.templatePreferenceIds,
        excludeTemplateId: item.templateId,
        preferNonFullBleed: true,
        templateShift: variantIndex * 7 + index * 2,
        rng,
      });
      const spec = getTemplateSpec(replacement);
      next[index] = {
        ...item,
        templateId: replacement,
        copyBudget: spec.maxTextBudget,
        isTextOnly: spec.imagePolicy === "none" || item.primaryAssetFilename === null,
        isFullBleed: spec.isFullBleed,
      };
      fullBleedCount = next.filter((entry) => entry.isFullBleed).length;
    }
  }

  if (next.length > 1 && !next.some((item) => item.isTextOnly)) {
    const targetIndex = next.findIndex((item) => item.role !== "cover");
    if (targetIndex >= 0) {
      const spec = getTemplateSpec("TEXT_ONLY_EDITORIAL");
      next[targetIndex] = {
        ...next[targetIndex],
        role: "text-only",
        primaryAssetFilename: null,
        topicLabel: "text",
        templateId: "TEXT_ONLY_EDITORIAL",
        copyBudget: spec.maxTextBudget,
        isTextOnly: true,
        isFullBleed: false,
      };
    }
  }

  return next;
}

async function hasThemeFactorySkill(rootDir: string): Promise<boolean> {
  const candidates = [
    path.join(rootDir, ".agents", "skills", "theme-factory", "SKILL.md"),
    path.join(rootDir, ".codex", "skills", "theme-factory", "SKILL.md"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

export async function planDocument(images: ScannedImage[], options: PlanOptions): Promise<PlannerResult> {
  const logs: string[] = [];
  const rootDir = options.rootDir ?? process.cwd();
  const intent = options.intent ?? "regenerate";
  const requestSpec = options.requestSpec;
  const variantIndex = Math.max(1, requestSpec.variantIndex || 1);
  const seed = requestSpec.seed;
  const rng = createRng(seed + variantIndex * 17);

  const { clusters, topicByFilename, proofAssetCount, lowSignalAssetCount } = buildTopicClusters(images);

  const docType = mapRequestDocKindToDocType(requestSpec.docKind);
  const pageSize = resolvePageSize({
    preset: requestSpec.pageSize.preset,
    widthMm: requestSpec.pageSize.widthMm,
    heightMm: requestSpec.pageSize.heightMm,
  });

  const fallbackPageCount = decideFallbackPageCount({
    docType,
    imageCount: images.length,
    topicCount: Math.max(clusters.length, 1),
    proofAssetCount,
    lowSignalAssetCount,
  });
  const pageCount = resolveRequestedPageCount(requestSpec.pageCount, fallbackPageCount);

  const rolePlan = buildRoleSequence({
    docType,
    pageCount,
    seed,
    variantIndex,
  });
  const roleSequence = rolePlan.roles;

  logs.push(`[planner] requestHash=${options.requestHash} job=${requestSpec.jobId}`);
  logs.push(`[planner] clusters=${clusters.length} proofAssets=${proofAssetCount} lowSignal=${lowSignalAssetCount}`);
  logs.push(`[planner] docType=${docType} pageSize=${pageSize.preset}(${pageSize.widthMm}x${pageSize.heightMm}mm) pageCount=${pageCount}`);
  logs.push(`[planner] rhythm=${rolePlan.rhythmId} role sequence: ${roleSequence.join(" -> ")}`);

  const referenceContext =
    options.referenceContext ??
    (await ensureReferenceIndex({
      rootDir,
      allowRebuild: intent !== "export",
      minRequiredCount: 8,
    }));

  const themeFactoryAvailable = await hasThemeFactorySkill(rootDir);
  const useReferenceDriven =
    referenceContext.required &&
    referenceContext.status === "fresh" &&
    !options.disableReferenceDrivenPlanning;

  let styleCandidateIds: string[] = [];
  let stylePreset = getStylePresetById("theme-modern-minimalist");
  let stylePresetSource: "references" | "builtin" = "builtin";
  let selectedStyleClusterIds: string[] = [];
  let representativeStyleRefIds: string[] = [];
  let styleReason = "seeded default";

  if (useReferenceDriven && referenceContext.index) {
    const styleSelection = selectReferenceStylePreset({
      referenceIndex: referenceContext.index,
      seed,
      variantIndex,
      themeFactoryAvailable,
    });
    stylePreset = styleSelection.selectedPreset;
    stylePresetSource = "references";
    styleCandidateIds = styleSelection.candidatePresetIds;
    selectedStyleClusterIds = styleSelection.selectedStyleClusterIds;
    representativeStyleRefIds = styleSelection.representativeRefIds;
    styleReason = styleSelection.reason;
  } else {
    const fallbackStyle = selectStylePreset({
      seed,
      variantIndex,
      referenceFilenames: [],
    });
    styleCandidateIds = fallbackStyle.candidatePresetIds;
    stylePreset = getStylePresetById(fallbackStyle.selectedPresetId);
    styleReason = fallbackStyle.reason;
  }

  const themeFactoryProof: ThemeFactoryProof = {
    available: themeFactoryAvailable,
    status: themeFactoryAvailable && useReferenceDriven ? "ran" : "skipped",
    reason: themeFactoryAvailable
      ? useReferenceDriven
        ? "reference representatives -> 3 candidates -> deterministic pick"
        : "references not eligible for theme-factory scoring"
      : "theme-factory skill not found",
  };

  logs.push(
    `[planner] referenceIndex required=${referenceContext.required} status=${referenceContext.status} count=${referenceContext.referenceCount} digest=${referenceContext.referenceDigest || "none"}`,
  );
  if (referenceContext.staleReason) {
    logs.push(`[planner] referenceIndex staleReason=${referenceContext.staleReason}`);
  }
  logs.push(
    `[planner] style source=${stylePresetSource} selected=${stylePreset.id} candidates=${styleCandidateIds.join(", ")} reason=${styleReason}`,
  );
  logs.push(`[planner] theme-factory ${themeFactoryProof.status} available=${themeFactoryProof.available} reason=${themeFactoryProof.reason}`);

  const layoutPlan =
    useReferenceDriven && referenceContext.index
      ? selectReferenceLayoutPlan({
          referenceIndex: referenceContext.index,
          pageCount,
          roles: roleSequence,
          seed,
          variantIndex,
        })
      : selectBuiltinLayoutPlan({
          pageCount,
          roles: roleSequence,
        });

  logs.push(
    `[planner] layout source=${layoutPlan.source} selectedClusters=${layoutPlan.selectedLayoutClusterIds.join(", ")} minCoverage=${layoutPlan.minRequiredLayoutClusters}`,
  );

  const assignmentByPage = new Map(layoutPlan.assignments.map((assignment) => [assignment.pageNumber, assignment] as const));

  const pools = new Map<AssetTopic, ScannedImage[]>();
  for (const topic of ["ui", "photo", "chart", "diagram", "people", "generic"] as const) {
    const topicImages = images.filter((image) => (topicByFilename.get(image.filename)?.topic ?? "generic") === topic);
    pools.set(topic, [...topicImages]);
  }

  const storyboardDraft: StoryboardItem[] = roleSequence.map((role, index) => {
    const required = requiresAsset(role);
    const canHaveAsset = optionalAsset(role) || required;
    const asset = canHaveAsset
      ? takeAsset({
          pools,
          topicByFilename,
          preferredTopics: ROLE_TOPIC_PRIORITY[role],
          required,
        })
      : null;

    const hasAsset = asset !== null;
    const assignment = assignmentByPage.get(index + 1);
    const preferredTemplateIds = assignment?.preferredTemplateIds ?? [];
    const templateId = templateForRole({
      role,
      hasAsset,
      preferredTemplateIds,
      templateShift: variantIndex * 19 + index * 7,
      rng,
    });

    const spec = getTemplateSpec(templateId);
    const topic = asset ? topicByFilename.get(asset.filename)?.topic ?? "generic" : "generic";

    return {
      pageNumber: index + 1,
      role,
      templateId,
      templatePreferenceIds: preferredTemplateIds,
      primaryAssetFilename: asset?.filename ?? null,
      topicLabel: topic,
      copyBudget: spec.maxTextBudget,
      successCriteria: successCriteria(role),
      isTextOnly: spec.imagePolicy === "none" || !hasAsset,
      isFullBleed: spec.isFullBleed,
      layoutClusterId: assignment?.layoutClusterId ?? "layout-builtin-01",
      layoutTuning: assignment?.layoutTuning ?? {
        columns: 2,
        heroRatio: 0.48,
        cardDensity: 0.44,
        headerRatio: 0.14,
        footerRatio: 0.1,
        rhythm: "balanced",
      },
    };
  });

  const storyboard = ensureDiversity(storyboardDraft, rng, variantIndex);
  const usedLayoutClusterIds = [...new Set(storyboard.map((item) => item.layoutClusterId))];

  const referenceUsageReport = {
    required: referenceContext.required,
    referenceCount: referenceContext.referenceCount,
    referenceDigest: referenceContext.referenceDigest,
    referenceIndexStatus: referenceContext.status,
    styleSource: stylePresetSource,
    layoutSource: layoutPlan.source,
    usedStyleClusterIds: selectedStyleClusterIds,
    usedLayoutClusterIds,
    minRequiredLayoutClusters: layoutPlan.minRequiredLayoutClusters,
    selectedLayoutClusterIds: layoutPlan.selectedLayoutClusterIds,
    representativeStyleRefIds,
    representativeLayoutRefIds: layoutPlan.representativeRefIds,
  };

  const plan: DocumentPlan = {
    requestSpec,
    requestHash: options.requestHash,
    docTitle: requestSpec.title,
    docType,
    pageSizePreset: pageSize.preset,
    pageSize,
    pageCount,
    variantIndex,
    seed,
    stylePresetId: stylePreset.id,
    stylePresetSource,
    stylePreset,
    styleCandidateIds,
    referenceDigest: referenceContext.referenceDigest,
    referenceCount: referenceContext.referenceCount,
    referenceIndexStatus: referenceContext.status,
    layoutPlan: {
      source: layoutPlan.source,
      selectedLayoutClusterIds: layoutPlan.selectedLayoutClusterIds,
      representativeRefIds: layoutPlan.representativeRefIds,
      minRequiredLayoutClusters: layoutPlan.minRequiredLayoutClusters,
      reason: layoutPlan.reason,
    },
    referenceUsageReport,
    themeFactoryProof,
    topicClusters: clusters,
    proofAssetCount,
    lowSignalAssetCount,
  };

  const templateRuns: string[] = [];
  let runCount = 1;
  for (let index = 1; index < storyboard.length; index += 1) {
    if (storyboard[index].templateId === storyboard[index - 1].templateId) {
      runCount += 1;
      continue;
    }
    templateRuns.push(`${storyboard[index - 1].templateId}x${runCount}`);
    runCount = 1;
  }
  if (storyboard.length > 0) {
    templateRuns.push(`${storyboard[storyboard.length - 1].templateId}x${runCount}`);
  }

  logs.push(
    `[planner] storyboard pages=${storyboard.length}, textOnly=${storyboard.filter((item) => item.isTextOnly).length}, fullBleed=${storyboard.filter((item) => item.isFullBleed).length}`,
  );
  logs.push(`[planner] template runs: ${templateRuns.join(", ")}`);

  return {
    plan,
    storyboard,
    logs,
  };
}

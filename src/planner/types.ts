import type { ScannedImage } from "@/src/io/scanImages";
import type { LayoutArchetype, ReferenceIndexStatus } from "@/src/io/referenceIndex";
import type { PageSizeSpec, PageSizePreset } from "@/src/layout/pageSize";
import type { StylePreset } from "@/src/layout/stylePresets";
import type { TemplateId, TextBudget } from "@/src/layout/templateCatalog";
import type { DocType } from "@/src/layout/types";
import type { RequestSpec } from "@/src/request/requestSpec";

export type PageRole =
  | "cover"
  | "section-divider"
  | "agenda"
  | "insight"
  | "solution"
  | "process"
  | "timeline"
  | "metrics"
  | "comparison"
  | "gallery"
  | "text-only"
  | "cta"
  | "topic";

export type AssetTopic = "ui" | "photo" | "chart" | "diagram" | "people" | "generic";

export type TopicCluster = {
  topic: AssetTopic;
  images: ScannedImage[];
  lowSignalCount: number;
};

export type StoryboardItem = {
  pageNumber: number;
  role: PageRole;
  templateId: TemplateId;
  templatePreferenceIds: TemplateId[];
  primaryAssetFilename: string | null;
  topicLabel: string;
  copyBudget: TextBudget;
  successCriteria: string;
  isTextOnly: boolean;
  isFullBleed: boolean;
  layoutClusterId: string;
  layoutTuning: LayoutArchetype;
};

export type ReferenceUsageReport = {
  required: boolean;
  referenceCount: number;
  referenceDigest: string;
  referenceIndexStatus: ReferenceIndexStatus;
  styleSource: "references" | "builtin";
  layoutSource: "references" | "builtin";
  usedStyleClusterIds: string[];
  usedLayoutClusterIds: string[];
  minRequiredLayoutClusters: number;
  selectedLayoutClusterIds: string[];
  representativeStyleRefIds: string[];
  representativeLayoutRefIds: string[];
};

export type ThemeFactoryProof = {
  available: boolean;
  status: "ran" | "skipped";
  reason: string;
};

export type DocumentPlan = {
  requestSpec: RequestSpec;
  requestHash: string;
  docTitle: string;
  docType: DocType;
  pageSizePreset: PageSizePreset;
  pageSize: PageSizeSpec;
  pageCount: number;
  variantIndex: number;
  seed: number;
  stylePresetId: string;
  stylePresetSource: "references" | "builtin";
  stylePreset: StylePreset;
  styleCandidateIds: string[];
  referenceDigest: string;
  referenceCount: number;
  referenceIndexStatus: ReferenceIndexStatus;
  layoutPlan: {
    source: "references" | "builtin";
    selectedLayoutClusterIds: string[];
    representativeRefIds: string[];
    minRequiredLayoutClusters: number;
    reason: string;
  };
  referenceUsageReport: ReferenceUsageReport;
  themeFactoryProof: ThemeFactoryProof;
  topicClusters: TopicCluster[];
  proofAssetCount: number;
  lowSignalAssetCount: number;
};

export type PlannerResult = {
  plan: DocumentPlan;
  storyboard: StoryboardItem[];
  logs: string[];
};

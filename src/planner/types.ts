import type { ScannedImage } from "@/src/io/scanImages";
import type { ScannedReference } from "@/src/io/scanReferences";
import type { PageSizeSpec, PageSizePreset } from "@/src/layout/pageSize";
import type { TemplateId, TextBudget } from "@/src/layout/templateCatalog";
import type { DocType } from "@/src/layout/types";

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
  primaryAssetFilename: string | null;
  topicLabel: string;
  copyBudget: TextBudget;
  successCriteria: string;
  isTextOnly: boolean;
  isFullBleed: boolean;
};

export type DocumentPlan = {
  docTitle: string;
  docType: DocType;
  pageSizePreset: PageSizePreset;
  pageSize: PageSizeSpec;
  pageCount: number;
  variantIndex: number;
  seed: number;
  stylePresetId: string;
  styleCandidateIds: string[];
  referenceSample: ScannedReference[];
  topicClusters: TopicCluster[];
  proofAssetCount: number;
  lowSignalAssetCount: number;
};

export type PlannerResult = {
  plan: DocumentPlan;
  storyboard: StoryboardItem[];
  logs: string[];
};


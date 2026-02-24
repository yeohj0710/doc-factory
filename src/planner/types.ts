import type { ScannedImage } from "@/src/io/scanImages";
import type { TemplateId, TextBudget } from "@/src/layout/templateCatalog";

export type DocumentGoal = "소개서" | "제안서" | "브로셔";

export type PageRole =
  | "cover"
  | "agenda"
  | "problem"
  | "solution"
  | "process"
  | "proof"
  | "package"
  | "cta"
  | "topic";

export type TopicCluster = {
  key: string;
  label: string;
  images: ScannedImage[];
  proofAssetCount: number;
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
  fullBleed: boolean;
};

export type DocumentPlan = {
  docTitle: string;
  targetAudience: string;
  documentGoal: DocumentGoal;
  narrativeSections: PageRole[];
  pageCount: number;
  topicClusters: TopicCluster[];
  proofAssetCount: number;
};

export type PlannerResult = {
  plan: DocumentPlan;
  storyboard: StoryboardItem[];
  logs: string[];
};

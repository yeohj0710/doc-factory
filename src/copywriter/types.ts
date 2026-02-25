import type { ScannedImage } from "@/src/io/scanImages";
import type { DocumentPlan, PageRole, StoryboardItem } from "@/src/planner/types";
import type { RequestDocKind } from "@/src/request/requestSpec";

export type CopywriterMode = "off" | "local" | "openai";

export type CopyBlockKind =
  | "headline"
  | "subhead"
  | "paragraph"
  | "bullets"
  | "callout"
  | "chips"
  | "metrics"
  | "footer";

export type CopyBlockIntent = "informative" | "playful" | "cta";

export type CopyBlockConstraints = {
  maxChars?: number;
  targetChars?: number;
  intent?: CopyBlockIntent;
};

export type CopyDeckBlock = {
  kind: CopyBlockKind;
  text?: string;
  items?: string[];
  constraints?: CopyBlockConstraints;
};

export type CopyDeckPage = {
  pageIndex: number;
  role: PageRole;
  blocks: CopyDeckBlock[];
};

export type CopyDeck = {
  docKind: RequestDocKind;
  language: string;
  tone: string;
  pages: CopyDeckPage[];
};

export type CopyFactsPage = {
  pageIndex: number;
  role: PageRole;
  topicLabel: string;
  imageFilename: string | null;
  imageHint: string;
  successCriteria: string;
};

export type CopyFacts = {
  requestHash: string;
  docKind: RequestDocKind;
  language: string;
  tone: string;
  title: string;
  prompt: string;
  contentBrief: string;
  sharedHints: string[];
  pages: CopyFactsPage[];
};

export type CopySlot = {
  pageIndex: number;
  role: PageRole;
  minBlocks: number;
  minChars: number;
  minBodyFontPt: number;
};

export type CopywriterAudit = {
  copywriterMode: CopywriterMode;
  requestedMode: CopywriterMode;
  effectiveMode: CopywriterMode;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  cacheKey: string;
  cacheHit: boolean;
  copyDeckHash: string;
  fallbackReason?: string;
};

export type CopywriterRunResult = {
  copyDeck: CopyDeck | null;
  slots: CopySlot[];
  audit: CopywriterAudit;
  logs: string[];
};

export type CopyDeckCacheRecord = {
  cacheKey: string;
  requestHash: string;
  mode: CopywriterMode;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  copyDeckHash: string;
  copyDeck: CopyDeck;
};

export type CopywriterBuildInput = {
  requestHash: string;
  plan: DocumentPlan;
  storyboard: StoryboardItem[];
  orderedImages: ScannedImage[];
};

export const COPYWRITER_PROMPT_VERSION = "copywriter.prompt.v1";
export const COPYWRITER_SCHEMA_VERSION = "copywriter.schema.v1";
export const COPYWRITER_LOCAL_MODEL = "local-rule-v1";

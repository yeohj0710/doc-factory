import { stableHashFromParts } from "@/src/io/hash";
import type { RequestSpec } from "@/src/request/requestSpec";
import { requestPageCountLabel } from "@/src/request/requestSpec";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function toStableJson(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => toStableJson(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${toStableJson(value[key] ?? null)}`).join(",")}}`;
}

export function computeRequestHash(params: {
  requestSpec: RequestSpec;
  orderedImageIds: string[];
  referenceDigest: string;
  pageSpec: {
    widthMm: number;
    heightMm: number;
  };
  variantIndex: number;
  seed: number;
}): string {
  const normalizedRequestSpec: JsonObject = {
    jobId: params.requestSpec.jobId,
    prompt: params.requestSpec.prompt,
    contentBrief: params.requestSpec.contentBrief ?? "",
    docKind: params.requestSpec.docKind,
    pageCount: requestPageCountLabel(params.requestSpec.pageCount),
    pageSize: `${params.requestSpec.pageSize.preset}:${params.requestSpec.pageSize.widthMm}x${params.requestSpec.pageSize.heightMm}`,
    title: params.requestSpec.title,
    language: params.requestSpec.language,
    tone: params.requestSpec.tone,
    constraints: [...params.requestSpec.constraints],
    variantIndex: params.requestSpec.variantIndex,
    seed: params.requestSpec.seed,
    copywriterMode: params.requestSpec.copywriterMode ?? "auto",
  };

  return stableHashFromParts(
    [
      toStableJson(normalizedRequestSpec),
      params.orderedImageIds.join(","),
      params.referenceDigest || "none",
      `${params.pageSpec.widthMm}x${params.pageSpec.heightMm}`,
      String(params.variantIndex),
      String(params.seed),
    ],
    16,
  );
}


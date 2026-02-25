import { buildCopyCacheKey, buildImageDigest, hashCopyDeck, readCopyDeckCache, writeCopyDeckCache } from "@/src/copywriter/cache";
import { buildCopyFacts, buildCopySlots, enforceCopyDeckDensity } from "@/src/copywriter/facts";
import { buildLocalCopyDeck } from "@/src/copywriter/local";
import { generateCopyDeckWithOpenAi } from "@/src/copywriter/openai";
import type { CopyDeck, CopywriterMode, CopywriterRunResult, CopywriterBuildInput } from "@/src/copywriter/types";
import {
  COPYWRITER_LOCAL_MODEL,
  COPYWRITER_PROMPT_VERSION,
  COPYWRITER_SCHEMA_VERSION,
} from "@/src/copywriter/types";

function parseMode(rawMode: string | undefined): CopywriterMode {
  const normalized = (rawMode ?? "local").trim().toLowerCase();
  if (normalized === "openai" || normalized === "off" || normalized === "local") {
    return normalized;
  }
  return "local";
}

function openAiModelFromEnv(): string {
  return process.env.COPYWRITER_OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

export async function resolveCopyDeck(params: {
  input: CopywriterBuildInput;
  rootDir?: string;
  forceRegenerate?: boolean;
  modeOverride?: string;
}): Promise<CopywriterRunResult> {
  const rootDir = params.rootDir ?? process.cwd();
  const requestedMode = parseMode(params.modeOverride ?? process.env.COPYWRITER_MODE);
  const promptVersion = COPYWRITER_PROMPT_VERSION;
  const schemaVersion = COPYWRITER_SCHEMA_VERSION;
  const forceRegenerate = params.forceRegenerate === true;

  const facts = buildCopyFacts(params.input);
  const slots = buildCopySlots(facts);

  if (requestedMode === "off") {
    return {
      copyDeck: null,
      slots,
      audit: {
        copywriterMode: "off",
        requestedMode,
        effectiveMode: "off",
        model: "off",
        promptVersion,
        schemaVersion,
        cacheKey: "off",
        cacheHit: false,
        copyDeckHash: "off",
      },
      logs: ["[copywriter] mode=off (disabled)"],
    };
  }

  const openAiModel = openAiModelFromEnv();
  const modelForKey = requestedMode === "openai" ? openAiModel : COPYWRITER_LOCAL_MODEL;
  const imageDigest = buildImageDigest(params.input.orderedImages.map((image) => image.id));

  const cacheKey = buildCopyCacheKey({
    requestHash: params.input.requestHash,
    promptVersion,
    schemaVersion,
    model: modelForKey,
    referenceDigest: params.input.plan.referenceDigest,
    imageDigest,
  });

  if (!forceRegenerate) {
    const cached = await readCopyDeckCache({
      rootDir,
      cacheKey,
    });

    if (cached) {
      await writeCopyDeckCache({
        rootDir,
        requestHash: params.input.requestHash,
        record: cached,
      });
      return {
        copyDeck: cached.copyDeck,
        slots,
        audit: {
          copywriterMode: cached.mode === "openai" ? "openai" : "local",
          requestedMode,
          effectiveMode: cached.mode === "openai" ? "openai" : "local",
          model: cached.model,
          promptVersion: cached.promptVersion,
          schemaVersion: cached.schemaVersion,
          cacheKey,
          cacheHit: true,
          copyDeckHash: cached.copyDeckHash,
        },
        logs: [`[copywriter] cache hit key=${cacheKey.slice(0, 12)} mode=${cached.mode}`],
      };
    }
  }

  let generatedMode: CopywriterMode = requestedMode;
  let generatedModel = modelForKey;
  let fallbackReason: string | undefined;
  let copyDeck: CopyDeck;

  if (requestedMode === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      generatedMode = "local";
      generatedModel = COPYWRITER_LOCAL_MODEL;
      fallbackReason = "OPENAI_API_KEY is missing; fell back to local copywriter";
      copyDeck = buildLocalCopyDeck({ facts, slots });
    } else {
      try {
        copyDeck = await generateCopyDeckWithOpenAi({
          apiKey,
          model: openAiModel,
          promptVersion,
          schemaVersion,
          facts,
          slots,
        });
        generatedMode = "openai";
        generatedModel = openAiModel;
      } catch (error) {
        generatedMode = "local";
        generatedModel = COPYWRITER_LOCAL_MODEL;
        fallbackReason =
          error instanceof Error
            ? `OpenAI copywriter failed; fell back to local (${error.message})`
            : "OpenAI copywriter failed; fell back to local";
        copyDeck = buildLocalCopyDeck({ facts, slots });
      }
    }
  } else {
    copyDeck = buildLocalCopyDeck({ facts, slots });
  }

  const densified = enforceCopyDeckDensity(copyDeck, slots);
  const copyDeckHash = hashCopyDeck(densified);

  await writeCopyDeckCache({
    rootDir,
    requestHash: params.input.requestHash,
    record: {
      cacheKey,
      requestHash: params.input.requestHash,
      mode: generatedMode,
      model: generatedModel,
      promptVersion,
      schemaVersion,
      copyDeckHash,
      copyDeck: densified,
    },
  });

  const logs = [`[copywriter] cache miss key=${cacheKey.slice(0, 12)} mode=${generatedMode} model=${generatedModel}`];
  if (fallbackReason) {
    logs.push(`[copywriter] ${fallbackReason}`);
  }

  return {
    copyDeck: densified,
    slots,
    audit: {
      copywriterMode: generatedMode,
      requestedMode,
      effectiveMode: generatedMode,
      model: generatedModel,
      promptVersion,
      schemaVersion,
      cacheKey,
      cacheHit: false,
      copyDeckHash,
      fallbackReason,
    },
    logs,
  };
}

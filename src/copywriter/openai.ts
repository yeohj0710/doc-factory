import "server-only";
import { assertCopyDeckShape, COPY_DECK_JSON_SCHEMA } from "@/src/copywriter/schema";
import type { CopyDeck, CopyFacts, CopySlot } from "@/src/copywriter/types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function buildSystemPrompt(params: {
  language: string;
  tone: string;
  docKind: string;
  promptVersion: string;
  schemaVersion: string;
}): string {
  return [
    `You are a deterministic copywriter for layout DSL pages.`,
    `Output must be valid JSON matching the provided JSON Schema only.`,
    `language=${params.language}, tone=${params.tone}, docKind=${params.docKind}.`,
    `promptVersion=${params.promptVersion}, schemaVersion=${params.schemaVersion}.`,
    `Never fabricate facts. Unknown values must be '(추후 기입)'.`,
    `No internal implementation terms in user-facing text.`,
    `For poster_set and onepager, each page must include at least 4 blocks and substantial text density.`,
  ].join("\n");
}

function buildUserPrompt(params: {
  facts: CopyFacts;
  slots: CopySlot[];
}): string {
  return JSON.stringify(
    {
      facts: params.facts,
      slots: params.slots,
      requirements: {
        mustUseBlocks: ["headline", "subhead", "paragraph", "bullets", "callout"],
        noFabrication: true,
        placeholderToken: "(추후 기입)",
      },
    },
    null,
    2,
  );
}

export async function generateCopyDeckWithOpenAi(params: {
  apiKey: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  facts: CopyFacts;
  slots: CopySlot[];
  timeoutMs?: number;
}): Promise<CopyDeck> {
  const timeoutMs = Math.max(10_000, params.timeoutMs ?? 45_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({
              language: params.facts.language,
              tone: params.facts.tone,
              docKind: params.facts.docKind,
              promptVersion: params.promptVersion,
              schemaVersion: params.schemaVersion,
            }),
          },
          {
            role: "user",
            content: buildUserPrompt({
              facts: params.facts,
              slots: params.slots,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "copy_deck",
            strict: true,
            schema: COPY_DECK_JSON_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const payload = (await response.json()) as ChatCompletionResponse;

    if (!response.ok) {
      const errorMessage = payload?.error?.message?.trim() || `OpenAI request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI returned empty copy deck response");
    }

    const parsed = JSON.parse(content);
    return assertCopyDeckShape(parsed);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`OpenAI request timed out after ${timeoutMs}ms`);
      }
      throw new Error(error.message);
    }
    throw new Error("OpenAI copy generation failed");
  } finally {
    clearTimeout(timer);
  }
}

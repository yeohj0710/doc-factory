import type { CopyDeck } from "@/src/copywriter/types";

export const COPY_DECK_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["docKind", "language", "tone", "pages"],
  properties: {
    docKind: {
      type: "string",
      enum: ["poster", "poster_set", "brochure", "onepager", "report", "cards"],
    },
    language: { type: "string", minLength: 2, maxLength: 12 },
    tone: { type: "string", minLength: 2, maxLength: 32 },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageIndex", "role", "blocks"],
        properties: {
          pageIndex: { type: "integer", minimum: 1, maximum: 128 },
          role: {
            type: "string",
            enum: [
              "cover",
              "section-divider",
              "agenda",
              "insight",
              "solution",
              "process",
              "timeline",
              "metrics",
              "comparison",
              "gallery",
              "text-only",
              "cta",
              "topic",
            ],
          },
          blocks: {
            type: "array",
            minItems: 1,
            maxItems: 16,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind"],
              properties: {
                kind: {
                  type: "string",
                  enum: ["headline", "subhead", "paragraph", "bullets", "callout", "chips", "metrics", "footer"],
                },
                text: { type: "string", minLength: 1, maxLength: 1200 },
                items: {
                  type: "array",
                  minItems: 1,
                  maxItems: 16,
                  items: { type: "string", minLength: 1, maxLength: 360 },
                },
                constraints: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    maxChars: { type: "integer", minimum: 1, maximum: 2000 },
                    targetChars: { type: "integer", minimum: 1, maximum: 2000 },
                    intent: {
                      type: "string",
                      enum: ["informative", "playful", "cta"],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export function assertCopyDeckShape(value: unknown): CopyDeck {
  if (!value || typeof value !== "object") {
    throw new Error("copy deck must be an object");
  }

  const deck = value as CopyDeck;
  if (!Array.isArray(deck.pages) || deck.pages.length === 0) {
    throw new Error("copy deck pages must be a non-empty array");
  }

  return deck;
}

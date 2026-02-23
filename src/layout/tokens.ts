import type { ScannedFont } from "@/src/io/scanFonts";
import { SYSTEM_FONT_STACK } from "@/src/io/scanFonts";

export type LayoutTokens = {
  colors: {
    canvas: string;
    page: string;
    text: string;
    mutedText: string;
    border: string;
    accent: string;
    softAccent: string;
  };
  spacingMm: {
    pageMargin: number;
    gutter: number;
    footerHeight: number;
    sectionGap: number;
  };
  fontScalePt: {
    caption: number;
    body: number;
    subtitle: number;
    title: number;
  };
  radiusMm: {
    sm: number;
    md: number;
  };
  font: {
    primary: string;
    fallback: string;
    cssStack: string;
  };
};

const BASE_TOKENS = {
  colors: {
    canvas: "#E9EEF5",
    page: "#FFFFFF",
    text: "#10213A",
    mutedText: "#4D5F7A",
    border: "#D1DAE6",
    accent: "#2F6EA6",
    softAccent: "#EAF2FA",
  },
  spacingMm: {
    pageMargin: 12,
    gutter: 8,
    footerHeight: 12,
    sectionGap: 6,
  },
  fontScalePt: {
    caption: 11,
    body: 12,
    subtitle: 14,
    title: 23,
  },
  radiusMm: {
    sm: 2,
    md: 4,
  },
} as const;

function quoteFontFamily(name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
}

export function createLayoutTokens(fonts: ScannedFont[]): LayoutTokens {
  const primary = fonts[0]?.familyName ?? "Segoe UI";
  const fallback = fonts[1]?.familyName ?? "Arial";

  const cssStack =
    fonts.length >= 2
      ? `${quoteFontFamily(primary)}, ${quoteFontFamily(fallback)}, ${SYSTEM_FONT_STACK}`
      : fonts.length === 1
        ? `${quoteFontFamily(primary)}, ${SYSTEM_FONT_STACK}`
        : SYSTEM_FONT_STACK;

  return {
    ...BASE_TOKENS,
    font: {
      primary,
      fallback,
      cssStack,
    },
  };
}

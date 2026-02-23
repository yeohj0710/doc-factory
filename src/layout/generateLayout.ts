import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";
import type { LayoutTokens } from "@/src/layout/tokens";
import { PAGE_SIZE_A4_PORTRAIT, type PageLayout } from "@/src/layout/types";

type TemplateKey = "A" | "B" | "C";

const A4_ASPECT_RATIO = PAGE_SIZE_A4_PORTRAIT.widthMm / PAGE_SIZE_A4_PORTRAIT.heightMm;

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  const withoutPrefix = stem.replace(
    /^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i,
    "",
  );

  const cleaned = withoutPrefix
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const fallback = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const finalText = cleaned.length > 0 ? cleaned : fallback;

  if (!finalText) {
    return "Untitled image";
  }

  return finalText.charAt(0).toUpperCase() + finalText.slice(1);
}

function chooseTemplate(image: ScannedImage): TemplateKey {
  const stem = path.parse(image.filename).name.toLowerCase();
  if (/(^|[\s._-])(cover|title)([\s._-]|$)/i.test(stem)) {
    return "B";
  }

  if (image.widthPx && image.heightPx) {
    const ratio = image.widthPx / image.heightPx;
    if (Math.abs(ratio - A4_ASPECT_RATIO) <= 0.08) {
      return "A";
    }
  }

  return "C";
}

function buildTemplateA(
  image: ScannedImage,
  caption: string,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const footerY = PAGE_SIZE_A4_PORTRAIT.heightMm - tokens.spacingMm.footerHeight;

  return {
    pageNumber,
    elements: [
      {
        type: "image",
        xMm: 0,
        yMm: 0,
        wMm: PAGE_SIZE_A4_PORTRAIT.widthMm,
        hMm: PAGE_SIZE_A4_PORTRAIT.heightMm,
        srcPublicPath: image.publicPath,
        fit: "cover",
      },
      {
        type: "rect",
        xMm: 0,
        yMm: footerY,
        wMm: PAGE_SIZE_A4_PORTRAIT.widthMm,
        hMm: tokens.spacingMm.footerHeight,
        fill: tokens.colors.page,
      },
      {
        type: "line",
        x1Mm: 0,
        y1Mm: footerY,
        x2Mm: PAGE_SIZE_A4_PORTRAIT.widthMm,
        y2Mm: footerY,
        stroke: tokens.colors.border,
        widthMm: 0.3,
      },
      {
        type: "text",
        xMm: tokens.spacingMm.pageMargin,
        yMm: footerY + 2,
        wMm: PAGE_SIZE_A4_PORTRAIT.widthMm - tokens.spacingMm.pageMargin * 2,
        hMm: tokens.spacingMm.footerHeight - 4,
        text: caption,
        fontSizePt: tokens.fontScalePt.caption,
        align: "left",
      },
    ],
  };
}

function buildTemplateB(
  image: ScannedImage,
  caption: string,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const topBandHeightMm = 44;
  const imageTopMm = topBandHeightMm + tokens.spacingMm.sectionGap;
  const imageHeightMm = PAGE_SIZE_A4_PORTRAIT.heightMm - imageTopMm - margin;

  return {
    pageNumber,
    elements: [
      {
        type: "rect",
        xMm: 0,
        yMm: 0,
        wMm: PAGE_SIZE_A4_PORTRAIT.widthMm,
        hMm: topBandHeightMm,
        fill: tokens.colors.softAccent,
      },
      {
        type: "text",
        xMm: margin,
        yMm: 10,
        wMm: PAGE_SIZE_A4_PORTRAIT.widthMm - margin * 2,
        hMm: 14,
        text: caption,
        fontSizePt: tokens.fontScalePt.title,
        bold: true,
        align: "left",
      },
      {
        type: "text",
        xMm: margin,
        yMm: 27,
        wMm: PAGE_SIZE_A4_PORTRAIT.widthMm - margin * 2,
        hMm: 8,
        text: path.parse(image.filename).name.replace(/[_-]+/g, " "),
        fontSizePt: tokens.fontScalePt.caption,
        align: "left",
      },
      {
        type: "line",
        x1Mm: margin,
        y1Mm: topBandHeightMm,
        x2Mm: PAGE_SIZE_A4_PORTRAIT.widthMm - margin,
        y2Mm: topBandHeightMm,
        stroke: tokens.colors.border,
        widthMm: 0.35,
      },
      {
        type: "image",
        xMm: margin,
        yMm: imageTopMm,
        wMm: PAGE_SIZE_A4_PORTRAIT.widthMm - margin * 2,
        hMm: imageHeightMm,
        srcPublicPath: image.publicPath,
        fit: "contain",
      },
    ],
  };
}

function buildTemplateC(
  image: ScannedImage,
  caption: string,
  pageNumber: number,
  tokens: LayoutTokens,
): PageLayout {
  const margin = tokens.spacingMm.pageMargin;
  const gutter = tokens.spacingMm.gutter;
  const textColumnWidthMm = 62;
  const contentHeightMm = PAGE_SIZE_A4_PORTRAIT.heightMm - margin * 2;
  const imageWidthMm =
    PAGE_SIZE_A4_PORTRAIT.widthMm - margin * 2 - gutter - textColumnWidthMm;
  const textColumnX = margin + imageWidthMm + gutter;

  const detailText = [
    caption,
    "",
    `Filename: ${path.parse(image.filename).name.replace(/[_-]+/g, " ")}`,
  ].join("\n");

  return {
    pageNumber,
    elements: [
      {
        type: "image",
        xMm: margin,
        yMm: margin,
        wMm: imageWidthMm,
        hMm: contentHeightMm,
        srcPublicPath: image.publicPath,
        fit: "contain",
      },
      {
        type: "rect",
        xMm: textColumnX,
        yMm: margin,
        wMm: textColumnWidthMm,
        hMm: contentHeightMm,
        fill: tokens.colors.softAccent,
        radiusMm: tokens.radiusMm.md,
      },
      {
        type: "text",
        xMm: textColumnX + 4,
        yMm: margin + 7,
        wMm: textColumnWidthMm - 8,
        hMm: 22,
        text: caption,
        fontSizePt: tokens.fontScalePt.subtitle,
        bold: true,
        align: "left",
      },
      {
        type: "line",
        x1Mm: textColumnX + 4,
        y1Mm: margin + 31,
        x2Mm: textColumnX + textColumnWidthMm - 4,
        y2Mm: margin + 31,
        stroke: tokens.colors.border,
        widthMm: 0.3,
      },
      {
        type: "text",
        xMm: textColumnX + 4,
        yMm: margin + 35,
        wMm: textColumnWidthMm - 8,
        hMm: contentHeightMm - 40,
        text: detailText,
        fontSizePt: tokens.fontScalePt.body,
        align: "left",
      },
    ],
  };
}

export function generateLayout(
  orderedImages: ScannedImage[],
  tokens: LayoutTokens,
): PageLayout[] {
  return orderedImages.map((image, index) => {
    const pageNumber = index + 1;
    const caption = cleanCaptionFromFilename(image.filename);
    const template = chooseTemplate(image);

    if (template === "A") {
      return buildTemplateA(image, caption, pageNumber, tokens);
    }
    if (template === "B") {
      return buildTemplateB(image, caption, pageNumber, tokens);
    }
    return buildTemplateC(image, caption, pageNumber, tokens);
  });
}

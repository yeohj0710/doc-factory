import type { ScannedImage } from "@/src/io/scanImages";
import { buildNarrative, detectCategory, pickTemplate } from "@/src/layout/content";
import type { LayoutTokens } from "@/src/layout/tokens";
import type { PageLayout } from "@/src/layout/types";
import { buildTemplatePage } from "@/src/layout/templates";

type CategoryCountMap = {
  dispense: number;
  app: number;
  consult: number;
  report: number;
  package: number;
  generic: number;
};

export function generateLayout(orderedImages: ScannedImage[], tokens: LayoutTokens): PageLayout[] {
  const categoryCounts: CategoryCountMap = {
    dispense: 0,
    app: 0,
    consult: 0,
    report: 0,
    package: 0,
    generic: 0,
  };

  return orderedImages.map((image, index) => {
    const category = detectCategory(image.filename);
    const categoryIndex = categoryCounts[category];
    const pageNumber = index + 1;
    const template = pickTemplate(image, index);
    const narrative = buildNarrative(image, pageNumber, template, categoryIndex);

    categoryCounts[category] += 1;
    return buildTemplatePage(image, narrative, pageNumber, tokens, template);
  });
}

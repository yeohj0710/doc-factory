import type { CSSProperties, ReactElement } from "react";
import { resolveImagePlacement } from "@/src/layout/imagePlacement";
import type { Element, ImageElement, LineElement, PageLayout } from "@/src/layout/types";

type PageViewProps = {
  page: PageLayout;
  fontFamily: string;
};

function renderLine(line: LineElement, key: string): ReactElement {
  const dx = line.x2Mm - line.x1Mm;
  const dy = line.y2Mm - line.y1Mm;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <div
      key={key}
      style={{
        position: "absolute",
        left: `${line.x1Mm}mm`,
        top: `${line.y1Mm - line.widthMm / 2}mm`,
        width: `${length}mm`,
        height: `${line.widthMm}mm`,
        background: line.stroke,
        transform: `rotate(${angleDeg}deg)`,
        transformOrigin: "0 50%",
      }}
    />
  );
}

function renderImage(image: ImageElement, key: string): ReactElement {
  const placement = resolveImagePlacement(image);
  const objectPosition = `${((image.anchorX ?? 0.5) * 100).toFixed(2)}% ${((image.anchorY ?? 0.5) * 100).toFixed(2)}%`;

  if (!placement) {
    return (
      <div
        key={key}
        style={{
          position: "absolute",
          left: `${image.xMm}mm`,
          top: `${image.yMm}mm`,
          width: `${image.wMm}mm`,
          height: `${image.hMm}mm`,
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Precise mm-based canvas positioning for local assets. */}
        <img
          src={image.srcPublicPath}
          alt=""
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: image.fit,
            objectPosition,
          }}
        />
      </div>
    );
  }

  return (
    <div
      key={key}
      style={{
        position: "absolute",
        left: `${image.xMm}mm`,
        top: `${image.yMm}mm`,
        width: `${image.wMm}mm`,
        height: `${image.hMm}mm`,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Precise mm-based canvas positioning for local assets. */}
      <img
        src={image.srcPublicPath}
        alt=""
        style={{
          position: "absolute",
          left: `${placement.xMm - image.xMm}mm`,
          top: `${placement.yMm - image.yMm}mm`,
          width: `${placement.wMm}mm`,
          height: `${placement.hMm}mm`,
          maxWidth: "none",
          maxHeight: "none",
        }}
      />
    </div>
  );
}

function renderElement(element: Element, index: number, fontFamily: string): ReactElement {
  if (element.type === "image") {
    return renderImage(element, `image-${index}`);
  }

  if (element.type === "text") {
    return (
      <p
        key={`text-${index}`}
        style={{
          position: "absolute",
          left: `${element.xMm}mm`,
          top: `${element.yMm}mm`,
          width: `${element.wMm}mm`,
          height: `${element.hMm}mm`,
          margin: 0,
          fontFamily,
          fontSize: `${element.fontSizePt}pt`,
          fontWeight: element.bold ? 700 : 400,
          textAlign: element.align ?? "left",
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          lineHeight: 1.25,
          color: element.color ?? "#10213A",
        }}
      >
        {element.text}
      </p>
    );
  }

  if (element.type === "rect") {
    return (
      <div
        key={`rect-${index}`}
        style={{
          position: "absolute",
          left: `${element.xMm}mm`,
          top: `${element.yMm}mm`,
          width: `${element.wMm}mm`,
          height: `${element.hMm}mm`,
          background: element.fill,
          borderRadius: element.radiusMm ? `${element.radiusMm}mm` : 0,
          border:
            element.stroke && element.strokeWidthMm
              ? `${element.strokeWidthMm}mm solid ${element.stroke}`
              : "none",
          opacity: element.fillOpacity ?? 1,
        }}
      />
    );
  }

  return renderLine(element, `line-${index}`);
}

export function PageView({ page, fontFamily }: PageViewProps): ReactElement {
  const style: CSSProperties = {
    fontFamily,
  };

  return (
    <article className="a4-page" style={style}>
      {page.elements.map((element, index) => renderElement(element, index, fontFamily))}
    </article>
  );
}

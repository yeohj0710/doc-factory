import type { CSSProperties, ReactElement } from "react";
import type { Element, LineElement, PageLayout } from "@/src/layout/types";

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

function renderElement(element: Element, index: number, fontFamily: string): ReactElement {
  if (element.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Precise mm-based canvas positioning for local assets.
      <img
        key={`image-${index}`}
        src={element.srcPublicPath}
        alt=""
        style={{
          position: "absolute",
          left: `${element.xMm}mm`,
          top: `${element.yMm}mm`,
          width: `${element.wMm}mm`,
          height: `${element.hMm}mm`,
          objectFit: element.fit,
        }}
      />
    );
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

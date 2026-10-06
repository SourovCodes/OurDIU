import {
  A4_HEIGHT,
  A4_WIDTH,
  COVER_PAGE_COLORS,
  COVER_PAGE_IMAGES,
  coverPageLayout,
  type CoverPageTemplate,
  type CoverPageValues,
} from "@ourdiu/shared/cover-pages";
import { useMemo } from "react";

/**
 * The cover page as it will print: the same layout the API draws into the PDF
 * (docs/PLAN.md, decision 39), as SVG, redrawn as the details are typed.
 */
export function CoverPagePreview({
  template,
  values,
  className,
}: {
  template: CoverPageTemplate;
  values: CoverPageValues;
  className?: string;
}) {
  const items = useMemo(
    () => coverPageLayout(template, values),
    [template, values],
  );
  return (
    <svg
      viewBox={`0 0 ${A4_WIDTH} ${A4_HEIGHT}`}
      role="img"
      aria-label="Preview of the cover page"
      className={className}
      // The page is paper: white in dark mode too.
      style={{ background: "#ffffff" }}
    >
      {items.map((item, i) => {
        if (item.kind === "image") {
          return (
            <image
              key={i}
              href={`/cover-page/${COVER_PAGE_IMAGES[item.image].file}`}
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              opacity={item.opacity}
            />
          );
        }
        const color = COVER_PAGE_COLORS[item.color];
        if (item.kind === "text") {
          return item.text ? (
            <text
              key={i}
              x={item.x}
              y={item.y}
              fontSize={item.size}
              fontWeight={item.bold ? 700 : 400}
              fontFamily="Helvetica, Arial, sans-serif"
              fill={color}
              xmlSpace="preserve"
            >
              {item.text}
            </text>
          ) : null;
        }
        if (item.kind === "line") {
          return (
            <line
              key={i}
              x1={item.x1}
              y1={item.y1}
              x2={item.x2}
              y2={item.y2}
              stroke={color}
              strokeWidth={item.width}
            />
          );
        }
        return (
          <rect
            key={i}
            x={item.x}
            y={item.y}
            width={item.w}
            height={item.h}
            rx={item.radius}
            fill="none"
            stroke={color}
            strokeWidth={item.width}
          />
        );
      })}
    </svg>
  );
}

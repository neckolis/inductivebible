import { useEffect, useRef, useState, useCallback } from "react";
import { useArrowStore } from "../store/arrowStore";
import { useToolStore } from "../store/toolStore";
import type { ArrowConnection, ArrowStyle, ArrowHeadStyle } from "../lib/storage";

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface WordPos {
  x: number;
  y: number;
  width: number;
  height: number;
}

// How far from the container edge margin-routed arrows run
const MARGIN_PAD = 12;
// Radius for rounded corners on margin-routed paths
const CORNER_R = 8;
// Vertical gap above word top for anchor points
const LIFT = 4;
// Minimum straight segment into each endpoint (must exceed chevron depth ~10px)
const APPROACH = 16;
// Threshold to consider two anchor points on the same visual line
const LINE_THRESHOLD = 10;

function getWordPos(
  container: HTMLElement,
  verse: number,
  word: number
): WordPos | null {
  const el = container.querySelector(
    `[data-verse="${verse}"][data-word="${word}"]`
  ) as HTMLElement | null;
  if (!el) return null;
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  return {
    x: eRect.left - cRect.left + eRect.width / 2,
    y: eRect.top - cRect.top + eRect.height / 2,
    width: eRect.width,
    height: eRect.height,
  };
}

function getDashArray(style: ArrowStyle): string | undefined {
  switch (style) {
    case "dashed": return "8 4";
    case "dotted": return "3 3";
    default: return undefined;
  }
}

/**
 * Build a path that avoids cutting through text.
 *
 * Same-line:  simple upward arc (quadratic bezier)
 * Cross-line: L-shaped route along the left or right margin with rounded corners.
 *             source → up → horizontal to margin → vertical along margin →
 *             horizontal to target → down to target
 */
function buildPath(
  from: WordPos,
  to: WordPos,
  containerWidth: number
): string {
  // Anchor at top-center of each word, lifted slightly above
  const x1 = from.x;
  const y1 = from.y - from.height / 2 - LIFT;
  const x2 = to.x;
  const y2 = to.y - to.height / 2 - LIFT;

  if (Math.abs(y1 - y2) < LINE_THRESHOLD) {
    // Same-line: straight up → arc → straight down
    const sy1 = y1 - APPROACH;
    const sy2 = y2 - APPROACH;
    const midX = (x1 + x2) / 2;
    const dist = Math.abs(x2 - x1);
    const arcH = Math.min(dist * 0.4, 40);
    return [
      `M ${x1} ${y1}`,
      `L ${x1} ${sy1}`,
      `Q ${midX} ${Math.min(sy1, sy2) - arcH} ${x2} ${sy2}`,
      `L ${x2} ${y2}`,
    ].join(" ");
  }

  // Cross-line: route along margin
  // Pick the side where both words are farther from (more room), or use right
  // margin if the average X is in the right half
  const avgX = (x1 + x2) / 2;
  const useRight = avgX > containerWidth / 2;
  const mx = useRight ? containerWidth - MARGIN_PAD : MARGIN_PAD;

  const goingDown = y1 < y2;
  const r = CORNER_R;
  // liftY is the horizontal routing altitude; ensure the straight drop
  // from endpoint to the first corner is at least APPROACH px
  const liftY1 = y1 - APPROACH - r;
  const liftY2 = y2 - APPROACH - r;

  if (goingDown) {
    // Source is above target
    // P0(x1,y1) → up to P1(x1,liftY1) → across to P2(mx,liftY1) → down to P3(mx,liftY2) → across to P4(x2,liftY2) → down to P5(x2,y2)
    const dx1 = mx > x1 ? 1 : -1; // direction from source to margin
    const dx2 = x2 > mx ? 1 : -1; // direction from margin to target

    return [
      `M ${x1} ${y1}`,
      // Up from source
      `L ${x1} ${liftY1 + r}`,
      // Corner: turn toward margin
      `Q ${x1} ${liftY1} ${x1 + dx1 * r} ${liftY1}`,
      // Horizontal to margin
      `L ${mx - dx1 * r} ${liftY1}`,
      // Corner: turn downward
      `Q ${mx} ${liftY1} ${mx} ${liftY1 + r}`,
      // Vertical along margin
      `L ${mx} ${liftY2 - r}`,
      // Corner: turn toward target
      `Q ${mx} ${liftY2} ${mx + dx2 * r} ${liftY2}`,
      // Horizontal to target
      `L ${x2 - dx2 * r} ${liftY2}`,
      // Corner: turn downward to target
      `Q ${x2} ${liftY2} ${x2} ${liftY2 + r}`,
      // Down to target
      `L ${x2} ${y2}`,
    ].join(" ");
  } else {
    // Source is below target — flip the logic
    const dx1 = mx > x1 ? 1 : -1;
    const dx2 = x2 > mx ? 1 : -1;

    return [
      `M ${x1} ${y1}`,
      // Up from source
      `L ${x1} ${liftY1 + r}`,
      // Corner: turn toward margin
      `Q ${x1} ${liftY1} ${x1 + dx1 * r} ${liftY1}`,
      // Horizontal to margin
      `L ${mx - dx1 * r} ${liftY1}`,
      // Corner: turn upward
      `Q ${mx} ${liftY1} ${mx} ${liftY1 - r}`,
      // Vertical along margin (going up)
      `L ${mx} ${liftY2 + r}`,
      // Corner: turn toward target
      `Q ${mx} ${liftY2} ${mx + dx2 * r} ${liftY2}`,
      // Horizontal to target
      `L ${x2 - dx2 * r} ${liftY2}`,
      // Corner: turn downward to target
      `Q ${x2} ${liftY2} ${x2} ${liftY2 + r}`,
      // Down to target
      `L ${x2} ${y2}`,
    ].join(" ");
  }
}

export function ArrowOverlay({ containerRef }: Props) {
  const arrows = useArrowStore((s) => s.arrows);
  const removeArrow = useArrowStore((s) => s.removeArrow);
  const arrowSource = useToolStore((s) => s.arrowSource);
  const [, setTick] = useState(0);
  const [hoveredArrow, setHoveredArrow] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const recompute = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    recompute();
  }, [arrows, arrowSource, recompute]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(recompute);
    ro.observe(container);

    window.addEventListener("scroll", recompute, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", recompute, true);
    };
  }, [containerRef, recompute]);

  const container = containerRef.current;
  if (!container) return null;
  if (arrows.length === 0 && !arrowSource) return null;

  const containerRect = container.getBoundingClientRect();
  const svgWidth = containerRect.width;
  const svgHeight = container.scrollHeight;

  function handleArrowClick(e: React.MouseEvent, arrow: ArrowConnection) {
    e.stopPropagation();
    e.preventDefault();
    removeArrow(arrow.id);
  }

  return (
    <svg
      ref={svgRef}
      className="absolute top-0 left-0"
      width={svgWidth}
      height={svgHeight}
      style={{ zIndex: 10, pointerEvents: "none" }}
    >
      <defs>
        {arrows.map((arrow) => {
          const hovered = hoveredArrow === arrow.id;
          const color = hovered ? "#ef4444" : arrow.color;
          return (
            <g key={`markers-${arrow.id}`}>
              {/* End arrowhead — V chevron pointing forward */}
              <marker
                id={`ah-end-${arrow.id}`}
                markerWidth="12"
                markerHeight="10"
                refX="10"
                refY="5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 1 1 L 10 5 L 1 9"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
              {/* Start arrowhead — V chevron pointing backward */}
              <marker
                id={`ah-start-${arrow.id}`}
                markerWidth="12"
                markerHeight="10"
                refX="2"
                refY="5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 11 1 L 2 5 L 11 9"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
            </g>
          );
        })}
      </defs>

      {arrows.map((arrow) => {
        const from = getWordPos(container, arrow.fromVerse, arrow.fromWord);
        const to = getWordPos(container, arrow.toVerse, arrow.toWord);
        if (!from || !to) return null;

        const path = buildPath(from, to, svgWidth);
        const lineStyle = arrow.style || "solid";
        const headStyle: ArrowHeadStyle = arrow.headStyle || "end";
        const isHovered = hoveredArrow === arrow.id;

        const hasEndHead = headStyle === "end" || headStyle === "both";
        const hasStartHead = headStyle === "start" || headStyle === "both";

        return (
          <g key={arrow.id}>
            {/* Invisible fat hit area for clicking */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={(e) => handleArrowClick(e, arrow)}
              onMouseEnter={() => setHoveredArrow(arrow.id)}
              onMouseLeave={() => setHoveredArrow(null)}
              onPointerDown={(e) => e.stopPropagation()}
            />
            {/* Visible arrow */}
            <path
              d={path}
              fill="none"
              stroke={isHovered ? "#ef4444" : arrow.color}
              strokeWidth={isHovered ? 2.5 : 2}
              strokeOpacity={isHovered ? 1 : 0.7}
              strokeDasharray={getDashArray(lineStyle)}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={hasEndHead ? `url(#ah-end-${arrow.id})` : undefined}
              markerStart={hasStartHead ? `url(#ah-start-${arrow.id})` : undefined}
              style={{ pointerEvents: "none", transition: "stroke 0.15s, stroke-width 0.15s" }}
            />
          </g>
        );
      })}

      {/* Pulsing ring on arrow source word */}
      {arrowSource && (() => {
        const pos = getWordPos(container, arrowSource.verse, arrowSource.wordIndex);
        if (!pos) return null;
        return (
          <circle
            cx={pos.x}
            cy={pos.y}
            r={pos.width / 2 + 4}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            opacity={0.8}
            style={{ pointerEvents: "none" }}
          >
            <animate
              attributeName="r"
              values={`${pos.width / 2 + 2};${pos.width / 2 + 8};${pos.width / 2 + 2}`}
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.8;0.3;0.8"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        );
      })()}
    </svg>
  );
}

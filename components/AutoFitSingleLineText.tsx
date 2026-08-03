"use client";

import {
  type CSSProperties,
  useLayoutEffect,
  useRef,
} from "react";
import styles from "./AutoFitSingleLineText.module.css";

type HeadingElement = "h1" | "h2" | "h3";

type Props = {
  text: string;
  as?: HeadingElement;
  className?: string;
  minSize?: number;
  maxSize?: number;
  safetyMargin?: number;
  style?: CSSProperties;
};

function visibleViewportWidth(): number {
  return Math.max(
    0,
    window.visualViewport?.width ??
      document.documentElement.clientWidth ??
      window.innerWidth,
  );
}

export function AutoFitSingleLineText({
  text,
  as: Tag = "h1",
  className = "",
  minSize = 7,
  maxSize = 62,
  safetyMargin = 12,
  style,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const heading = headingRef.current;
    const container = heading?.parentElement;

    if (!heading || !container) return;

    let animationFrame = 0;
    let measurementNode: HTMLSpanElement | null = null;

    const createMeasurementNode = () => {
      if (measurementNode) return measurementNode;

      measurementNode = document.createElement("span");
      measurementNode.setAttribute("aria-hidden", "true");
      Object.assign(measurementNode.style, {
        position: "fixed",
        inset: "auto auto -10000px -10000px",
        visibility: "hidden",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        width: "max-content",
        maxWidth: "none",
        overflow: "visible",
        contain: "layout style paint",
      });
      document.body.appendChild(measurementNode);
      return measurementNode;
    };

    const measureAtSize = (
      fontSize: number,
      computed: CSSStyleDeclaration,
    ): number => {
      const node = createMeasurementNode();

      node.textContent = text;
      node.style.fontFamily = computed.fontFamily;
      node.style.fontStyle = computed.fontStyle;
      node.style.fontWeight = computed.fontWeight;
      node.style.fontVariant = computed.fontVariant;
      node.style.fontStretch = computed.fontStretch;
      node.style.lineHeight = computed.lineHeight;
      node.style.letterSpacing = computed.letterSpacing;
      node.style.textTransform = computed.textTransform;
      node.style.fontSize = `${fontSize}px`;

      return node.getBoundingClientRect().width;
    };

    const fitText = () => {
      window.cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        const viewportWidth = visibleViewportWidth();
        const headingRect = heading.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const computed = window.getComputedStyle(heading);
        const isRtl = computed.direction === "rtl";

        const visibleLeft = Math.max(
          0,
          Math.min(headingRect.left, containerRect.left),
        );
        const visibleRight = Math.min(
          viewportWidth - safetyMargin,
          containerRect.right,
        );
        const viewportAvailable = Math.max(
          0,
          viewportWidth - Math.max(headingRect.left, 0) - safetyMargin,
        );
        const containerAvailable = Math.max(0, visibleRight - visibleLeft);
        const renderedBoxWidth = Math.max(
          0,
          Math.min(headingRect.width || containerRect.width, viewportAvailable),
        );

        const availableWidth = Math.floor(
          Math.max(
            0,
            Math.min(
              viewportAvailable,
              containerAvailable || viewportAvailable,
              renderedBoxWidth || viewportAvailable,
            ),
          ),
        );

        if (availableWidth <= 0) return;

        heading.style.width = `${availableWidth}px`;
        heading.style.maxWidth = `${availableWidth}px`;
        heading.style.minWidth = "0";
        heading.style.whiteSpace = "nowrap";
        heading.style.overflow = "hidden";
        heading.style.textOverflow = "clip";
        heading.style.wordBreak = "keep-all";
        heading.style.overflowWrap = "normal";
        heading.style.hyphens = "none";
        heading.style.transform = "none";
        heading.style.transformOrigin = isRtl ? "right center" : "left center";

        const preferredMinimum = Math.max(6, Math.min(minSize, maxSize));
        let lower = preferredMinimum;
        let upper = Math.max(lower, maxSize);
        let fittedSize = lower;

        for (let iteration = 0; iteration < 16; iteration += 1) {
          const candidate = (lower + upper) / 2;
          const measuredWidth = measureAtSize(candidate, computed);

          if (measuredWidth <= availableWidth) {
            fittedSize = candidate;
            lower = candidate;
          } else {
            upper = candidate;
          }
        }

        heading.style.fontSize = `${Math.floor(fittedSize * 10) / 10}px`;

        let finalWidth = measureAtSize(fittedSize, computed);

        if (finalWidth > availableWidth) {
          let emergencySize = fittedSize;

          while (emergencySize > 6 && finalWidth > availableWidth) {
            emergencySize = Math.max(6, emergencySize - 0.5);
            finalWidth = measureAtSize(emergencySize, computed);
          }

          heading.style.fontSize = `${emergencySize}px`;

          if (finalWidth > availableWidth) {
            const horizontalScale = Math.max(
              0.35,
              Math.min(1, availableWidth / finalWidth),
            );
            heading.style.transform = `scaleX(${horizontalScale})`;
          }
        }
      });
    };

    const resizeObserver = new ResizeObserver(fitText);
    resizeObserver.observe(container);

    window.addEventListener("resize", fitText);
    window.visualViewport?.addEventListener("resize", fitText);
    window.visualViewport?.addEventListener("scroll", fitText);

    const fontSet = document.fonts;
    const handleFontsChanged = () => fitText();

    void fontSet.ready.then(fitText);
    fontSet.addEventListener?.("loadingdone", handleFontsChanged);

    fitText();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitText);
      window.visualViewport?.removeEventListener("resize", fitText);
      window.visualViewport?.removeEventListener("scroll", fitText);
      fontSet.removeEventListener?.("loadingdone", handleFontsChanged);
      measurementNode?.remove();
    };
  }, [maxSize, minSize, safetyMargin, text]);

  return (
    <Tag
      ref={headingRef}
      className={`${styles.singleLine} ${className}`.trim()}
      title={text}
      aria-label={text}
      style={{
        ...style,
        fontSize: `${maxSize}px`,
      }}
    >
      {text}
    </Tag>
  );
}

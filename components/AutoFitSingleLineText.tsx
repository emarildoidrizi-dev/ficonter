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

function getViewportWidth(): number {
  return Math.max(
    0,
    Math.floor(
      window.visualViewport?.width ??
        document.documentElement.clientWidth ??
        window.innerWidth,
    ),
  );
}

export function AutoFitSingleLineText({
  text,
  as: Tag = "h1",
  className = "",
  minSize = 8,
  maxSize = 62,
  safetyMargin = 24,
  style,
}: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    const parent = container?.parentElement;

    if (!container || !textElement || !parent) return;

    let animationFrame = 0;

    const fit = () => {
      window.cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        const viewportWidth = getViewportWidth();
        const containerRect = container.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();

        const leftEdge = Math.max(
          0,
          containerRect.left,
          parentRect.left,
        );

        const viewportSpace = Math.max(
          0,
          viewportWidth - leftEdge - safetyMargin,
        );

        const parentVisibleRight = Math.min(
          viewportWidth - safetyMargin,
          parentRect.right,
        );

        const parentVisibleSpace = Math.max(
          0,
          parentVisibleRight - leftEdge,
        );

        const availableWidth = Math.floor(
          Math.min(
            viewportSpace,
            parentVisibleSpace || viewportSpace,
          ),
        );

        if (availableWidth <= 0) return;

        container.style.width = `${availableWidth}px`;
        container.style.maxWidth = `${availableWidth}px`;
        container.style.minWidth = "0";
        container.style.overflow = "hidden";
        container.style.whiteSpace = "nowrap";

        textElement.style.transform = "none";
        textElement.style.fontSize = `${maxSize}px`;

        const minimum = Math.max(6, Math.min(minSize, maxSize));
        let low = minimum;
        let high = Math.max(minimum, maxSize);
        let best = minimum;

        for (let iteration = 0; iteration < 18; iteration += 1) {
          const candidate = (low + high) / 2;
          textElement.style.fontSize = `${candidate}px`;

          const renderedWidth = textElement.getBoundingClientRect().width;

          if (renderedWidth <= availableWidth - 2) {
            best = candidate;
            low = candidate;
          } else {
            high = candidate;
          }
        }

        textElement.style.fontSize =
          `${Math.floor(best * 10) / 10}px`;
        textElement.style.transform = "none";

        const finalRenderedWidth =
          textElement.getBoundingClientRect().width;

        if (finalRenderedWidth > availableWidth - 2) {
          const scale = Math.max(
            0.25,
            Math.min(
              1,
              (availableWidth - 2) / finalRenderedWidth,
            ),
          );

          textElement.style.transform = `scaleX(${scale})`;
        }

        container.dataset.fitted = "true";
      });
    };

    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    observer.observe(container);

    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);

    const fontSet = document.fonts;
    const refitAfterFonts = () => fit();

    void fontSet.ready.then(fit);
    fontSet.addEventListener?.("loadingdone", refitAfterFonts);

    fit();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
      fontSet.removeEventListener?.("loadingdone", refitAfterFonts);
    };
  }, [maxSize, minSize, safetyMargin, text]);

  return (
    <Tag
      ref={containerRef}
      className={`${styles.container} ${className}`.trim()}
      title={text}
      aria-label={text}
      style={style}
    >
      <span ref={textRef} className={styles.text}>
        {text}
      </span>
    </Tag>
  );
}

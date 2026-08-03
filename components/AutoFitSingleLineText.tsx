"use client";

import {
  type CSSProperties,
  useLayoutEffect,
  useMemo,
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

function safeViewportWidth(): number {
  if (typeof window === "undefined") return 390;

  return Math.max(
    240,
    window.visualViewport?.width ??
      document.documentElement.clientWidth ??
      window.innerWidth ??
      390,
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const fallbackFontSize = useMemo(() => {
    const characterCount = Math.max(1, Array.from(text.trim()).length);
    const widthFactor = 0.78;
    const viewportCoefficient = 100 / (characterCount * widthFactor);
    const marginCoefficient =
      safetyMargin / (characterCount * widthFactor);

    return `clamp(${minSize}px, calc(${viewportCoefficient.toFixed(
      5,
    )}vw - ${marginCoefficient.toFixed(3)}px), ${maxSize}px)`;
  }, [maxSize, minSize, safetyMargin, text]);

  useLayoutEffect(() => {
    const heading = headingRef.current;
    const textElement = textRef.current;

    if (!heading || !textElement) return;

    let animationFrame = 0;

    const fitText = () => {
      window.cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        textElement.style.transform = "none";

        const headingRect = heading.getBoundingClientRect();
        const parentRect = heading.parentElement?.getBoundingClientRect();
        const viewportWidth = safeViewportWidth();

        const viewportAvailable = Math.max(
          40,
          viewportWidth -
            Math.max(0, headingRect.left) -
            safetyMargin,
        );

        const containerAvailable = Math.max(
          0,
          heading.clientWidth,
          heading.parentElement?.clientWidth ?? 0,
          parentRect?.width ?? 0,
        );

        const availableWidth = Math.max(
          40,
          Math.min(
            viewportAvailable,
            containerAvailable > 0
              ? containerAvailable
              : viewportAvailable,
          ),
        );

        let low = Math.max(6, minSize);
        let high = Math.max(low, maxSize);
        let best = low;

        for (let iteration = 0; iteration < 18; iteration += 1) {
          const candidate = (low + high) / 2;
          textElement.style.fontSize = `${candidate}px`;

          const renderedWidth =
            textElement.scrollWidth ||
            textElement.getBoundingClientRect().width;

          if (renderedWidth <= availableWidth - 4) {
            best = candidate;
            low = candidate;
          } else {
            high = candidate;
          }
        }

        textElement.style.fontSize =
          `${Math.floor(best * 10) / 10}px`;

        const finalRenderedWidth =
          textElement.scrollWidth ||
          textElement.getBoundingClientRect().width;

        if (finalRenderedWidth > availableWidth - 4) {
          const scale = Math.max(
            0.25,
            Math.min(
              1,
              (availableWidth - 4) / finalRenderedWidth,
            ),
          );

          textElement.style.transform = `scaleX(${scale})`;
        }
      });
    };

    const observer = new ResizeObserver(fitText);
    observer.observe(heading);

    if (heading.parentElement) {
      observer.observe(heading.parentElement);
    }

    window.addEventListener("resize", fitText);
    window.visualViewport?.addEventListener("resize", fitText);

    const handleFontsLoaded = () => fitText();
    void document.fonts.ready.then(fitText);
    document.fonts.addEventListener?.(
      "loadingdone",
      handleFontsLoaded,
    );

    fitText();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", fitText);
      window.visualViewport?.removeEventListener(
        "resize",
        fitText,
      );
      document.fonts.removeEventListener?.(
        "loadingdone",
        handleFontsLoaded,
      );
    };
  }, [maxSize, minSize, safetyMargin, text]);

  return (
    <Tag
      ref={headingRef}
      className={`${styles.container} ${className}`.trim()}
      title={text}
      aria-label={text}
      style={style}
    >
      <span
        ref={textRef}
        className={styles.text}
        style={{ fontSize: fallbackFontSize }}
      >
        {text}
      </span>
    </Tag>
  );
}

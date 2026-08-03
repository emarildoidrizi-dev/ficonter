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

export function AutoFitSingleLineText({
  text,
  as: Tag = "h1",
  className = "",
  minSize = 8,
  maxSize = 62,
  safetyMargin = 8,
  style,
}: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;

    if (!container || !textElement) return;

    let frame = 0;

    const fit = () => {
      window.cancelAnimationFrame(frame);

      frame = window.requestAnimationFrame(() => {
        const availableWidth = Math.max(
          40,
          container.clientWidth - safetyMargin,
        );

        textElement.style.transform = "none";

        let low = Math.max(6, minSize);
        let high = Math.max(low, maxSize);
        let best = low;

        for (let iteration = 0; iteration < 16; iteration += 1) {
          const candidate = (low + high) / 2;
          textElement.style.fontSize = `${candidate}px`;

          const renderedWidth = textElement.scrollWidth;

          if (renderedWidth <= availableWidth) {
            best = candidate;
            low = candidate;
          } else {
            high = candidate;
          }
        }

        textElement.style.fontSize =
          `${Math.floor(best * 10) / 10}px`;

        const finalWidth = textElement.scrollWidth;

        if (finalWidth > availableWidth) {
          const scale = Math.max(
            0.35,
            Math.min(1, availableWidth / finalWidth),
          );

          textElement.style.transform = `scaleX(${scale})`;
        }
      });
    };

    const observer = new ResizeObserver(fit);
    observer.observe(container);

    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);

    const fontListener = () => fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener?.("loadingdone", fontListener);

    fit();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      document.fonts.removeEventListener?.(
        "loadingdone",
        fontListener,
      );
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
      <span
        ref={textRef}
        className={styles.text}
        style={{ fontSize: `${maxSize}px` }}
      >
        {text}
      </span>
    </Tag>
  );
}

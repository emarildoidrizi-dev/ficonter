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
  style?: CSSProperties;
};

export function AutoFitSingleLineText({
  text,
  as: Tag = "h1",
  className = "",
  minSize = 10,
  maxSize = 62,
  style,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const heading = headingRef.current;
    const container = heading?.parentElement;

    if (!heading || !container) return;

    let animationFrame = 0;

    const fitText = () => {
      window.cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        const availableWidth = Math.max(
          0,
          Math.min(container.clientWidth, heading.clientWidth),
        );

        if (availableWidth <= 0) return;

        heading.style.fontSize = `${maxSize}px`;

        let lower = Math.max(8, minSize);
        let upper = Math.max(lower, maxSize);
        let fittedSize = lower;

        for (let iteration = 0; iteration < 14; iteration += 1) {
          const candidate = (lower + upper) / 2;
          heading.style.fontSize = `${candidate}px`;

          if (heading.scrollWidth <= availableWidth + 0.5) {
            fittedSize = candidate;
            lower = candidate;
          } else {
            upper = candidate;
          }
        }

        heading.style.fontSize = `${Math.floor(fittedSize * 10) / 10}px`;
      });
    };

    const resizeObserver = new ResizeObserver(fitText);
    resizeObserver.observe(container);

    window.addEventListener("resize", fitText);
    void document.fonts?.ready.then(fitText);
    fitText();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitText);
    };
  }, [maxSize, minSize, text]);

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

"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CircleGauge,
  PiggyBank,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import styles from "./LandingHeroShowcase.module.css";

type ShowcaseSlide = {
  key: string;
  label: string;
  title: string;
  copy: string;
  icon: typeof WalletCards;
  metrics: readonly [
    { label: string; value: string },
    { label: string; value: string },
    { label: string; value: string },
    { label: string; value: string },
  ];
  note: string;
  progress?: number;
  bars?: readonly number[];
};

const slides: readonly ShowcaseSlide[] = [
  {
    key: "personal",
    label: "Personal",
    title: "Monthly planning",
    copy: "Keep the month understandable after commitments, goals and reserves.",
    icon: WalletCards,
    metrics: [
      { label: "Available", value: "€6,260" },
      { label: "Income", value: "€8,420" },
      { label: "Committed", value: "€2,160" },
      { label: "Reserve", value: "€1,850" },
    ],
    note: "72% of this month’s plan is funded",
    progress: 72,
  },
  {
    key: "business",
    label: "Business",
    title: "Business performance",
    copy: "Separate operating figures from personal money while keeping both close at hand.",
    icon: BriefcaseBusiness,
    metrics: [
      { label: "Revenue", value: "€18,420" },
      { label: "Costs", value: "€11,240" },
      { label: "Margin", value: "31.6%" },
      { label: "Reserve", value: "€4,850" },
    ],
    note: "Revenue and operating costs in one focused view",
    bars: [38, 52, 47, 63, 72, 84, 69],
  },
  {
    key: "wealth",
    label: "Wealth",
    title: "Goals & long-term progress",
    copy: "Follow reserves, goals and net-worth direction without losing sight of today.",
    icon: TrendingUp,
    metrics: [
      { label: "Net worth", value: "€42,680" },
      { label: "Goals", value: "€12,400" },
      { label: "Reserve", value: "€8,250" },
      { label: "12 months", value: "+8.4%" },
    ],
    note: "Long-term progress stays connected to the monthly plan",
    bars: [35, 42, 46, 53, 58, 66, 78],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    title: "Know what needs attention",
    copy: "Turn financial activity into a short list of signals, priorities and next steps.",
    icon: Sparkles,
    metrics: [
      { label: "Health", value: "78 / 100" },
      { label: "Cash flow", value: "+€3,510" },
      { label: "Opportunity", value: "€320/mo" },
      { label: "Next bill", value: "€740" },
    ],
    note: "Focused insights without adding noise",
    progress: 78,
  },
] as const;

const AUTO_ROTATE_MS = 5000;
const MANUAL_PAUSE_MS = 10000;

export function LandingHeroShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const manualPauseTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeSlide = slides[activeIndex];
  const isPaused = hoverPaused || focusPaused || manualPaused;

  useEffect(() => {
    if (isPaused) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTO_ROTATE_MS);

    return () => window.clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    return () => {
      if (manualPauseTimer.current !== null) {
        window.clearTimeout(manualPauseTimer.current);
      }
    };
  }, []);

  const pauseAfterManualChange = () => {
    setManualPaused(true);
    if (manualPauseTimer.current !== null) {
      window.clearTimeout(manualPauseTimer.current);
    }
    manualPauseTimer.current = window.setTimeout(() => {
      setManualPaused(false);
      manualPauseTimer.current = null;
    }, MANUAL_PAUSE_MS);
  };

  const selectSlide = (index: number) => {
    setActiveIndex(index);
    pauseAfterManualChange();
  };

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
    pauseAfterManualChange();
  };

  const ActiveIcon = activeSlide.icon;

  return (
    <div
      ref={rootRef}
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="FICONTER workspace and module preview"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          setFocusPaused(false);
        }
      }}
      data-slide={activeSlide.key}
    >
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        aria-label="Show previous FICONTER module"
        onClick={() => move(-1)}
      >
        <ArrowLeft size={16} aria-hidden="true" />
      </button>

      <div className={styles.slide} key={activeSlide.key}>
        <div className={styles.slideHeader}>
          <div className={styles.identity}>
            <span className={styles.iconWrap} aria-hidden="true">
              <ActiveIcon size={17} />
            </span>
            <div>
              <span className={styles.label}>{activeSlide.label}</span>
              <strong>{activeSlide.title}</strong>
            </div>
          </div>
          <span className={styles.previewTag}>Illustrative preview</span>
        </div>

        <p className={styles.copy}>{activeSlide.copy}</p>

        <div className={styles.metrics}>
          {activeSlide.metrics.map((metric) => (
            <div className={styles.metric} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className={styles.footerRow}>
          <div className={styles.signal} aria-hidden="true">
            {typeof activeSlide.progress === "number" ? (
              <span className={styles.progressTrack}>
                <i style={{ width: `${activeSlide.progress}%` }} />
              </span>
            ) : (
              <span className={styles.bars}>
                {activeSlide.bars?.map((height, index) => (
                  <i key={`${activeSlide.key}-${index}`} style={{ height: `${height}%` }} />
                ))}
              </span>
            )}
          </div>
          <span className={styles.note}>{activeSlide.note}</span>
          <div className={styles.dots} aria-label="Choose FICONTER module preview">
            {slides.map((slide, index) => (
              <button
                type="button"
                key={slide.key}
                className={index === activeIndex ? styles.dotActive : styles.dot}
                aria-label={`Show ${slide.label} preview`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => selectSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight}`}
        aria-label="Show next FICONTER module"
        onClick={() => move(1)}
      >
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

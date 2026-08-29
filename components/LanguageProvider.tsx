"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CHANGED_EVENT,
  LANGUAGE_COOKIE_NAME,
  LANGUAGE_STORAGE_KEY,
  getLanguageOption,
  normalizeLanguage,
  type FiconterLanguage,
} from "@/lib/i18n/config";
import { translateMessage, type TranslationKey } from "@/lib/i18n/messages";
import { translateRuntimePhrase } from "@/lib/i18n/runtimeTranslator";
import { translateGovernanceTemplate } from "@/lib/i18n/governanceRuntimeTemplates";
import { translateGovernancePhrase } from "@/lib/i18n/governanceUiCatalog";
import { translateGovernancePhraseBatch2 } from "@/lib/i18n/governanceUiCatalogBatch2";
import { translateGovernancePhraseBatch3 } from "@/lib/i18n/governanceUiCatalogBatch3";
import { translateGovernancePhraseBatch4 } from "@/lib/i18n/governanceUiCatalogBatch4";
import { translateGovernancePhraseBatch5 } from "@/lib/i18n/governanceUiCatalogBatch5";
import { translateGovernancePhraseBatch6 } from "@/lib/i18n/governanceUiCatalogBatch6";
import { translateGovernancePhraseBatch7 } from "@/lib/i18n/governanceUiCatalogBatch7";
import { translateGovernancePhraseBatch8 } from "@/lib/i18n/governanceUiCatalogBatch8";

type LanguageContextValue = {
  language: FiconterLanguage;
  locale: string;
  direction: "ltr" | "rtl";
  changeLanguage: (language: FiconterLanguage, persistAccount?: boolean) => Promise<void>;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const TRANSLATABLE_ATTRIBUTES = [
  "aria-label",
  "aria-description",
  "placeholder",
  "title",
  "alt",
] as const;

const OBSERVED_TRANSLATABLE_ATTRIBUTES = [
  ...TRANSLATABLE_ATTRIBUTES,
  "label",
] as const;

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "CODE",
  "PRE",
  "TEXTAREA",
  "NOSCRIPT",
]);

type TextTranslationState = {
  source: string;
  rendered: string;
};

type AttributeTranslationState = Record<string, TextTranslationState>;

function normalizeSource(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function renderTranslatedText(
  source: string,
  language: FiconterLanguage,
): string {
  if (!source.trim()) return source;

  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  const normalized = normalizeSource(source);
  const runtimeTranslation = translateRuntimePhrase(language, normalized);
  const translated = runtimeTranslation === normalized
    ? translateGovernanceTemplate(language, normalized)
      ?? translateGovernancePhrase(language, normalized)
      ?? translateGovernancePhraseBatch2(language, normalized)
      ?? translateGovernancePhraseBatch3(language, normalized)
      ?? translateGovernancePhraseBatch4(language, normalized)
      ?? translateGovernancePhraseBatch5(language, normalized)
      ?? translateGovernancePhraseBatch6(language, normalized)
      ?? translateGovernancePhraseBatch7(language, normalized)
      ?? translateGovernancePhraseBatch8(language, normalized)
      ?? normalized
    : runtimeTranslation;

  return translated === normalized
    ? source
    : `${leading}${translated}${trailing}`;
}

function shouldSkipElement(element: Element | null): boolean {
  if (!element) return false;
  if (SKIP_TAGS.has(element.tagName)) return true;
  return Boolean(element.closest("[data-no-translate='true']"));
}

function createDocumentTranslator(
  getLanguage: () => FiconterLanguage,
) {
  const textState = new WeakMap<Text, TextTranslationState>();
  const attributeState = new WeakMap<Element, AttributeTranslationState>();
  let applying = false;

  function processTextNode(node: Text) {
    const parent = node.parentElement;
    if (shouldSkipElement(parent)) return;

    const current = node.data;
    let state = textState.get(node);

    if (!state) {
      state = { source: current, rendered: current };
    } else if (!applying && current !== state.rendered) {
      state.source = current;
    }

    const rendered = renderTranslatedText(
      state.source,
      getLanguage(),
    );

    state.rendered = rendered;
    textState.set(node, state);

    if (current !== rendered) {
      applying = true;
      node.data = rendered;
      applying = false;
    }
  }

  function processNativeSelectLabel(
    element: Element,
    state: AttributeTranslationState,
  ) {
    if (element.tagName !== "OPTION" && element.tagName !== "OPTGROUP") {
      return;
    }

    const stateKey = "__native-select-label";
    const currentSource = element.tagName === "OPTGROUP"
      ? element.getAttribute("label") ?? ""
      : element.textContent ?? "";
    let entry = state[stateKey];

    if (!entry) {
      entry = { source: currentSource, rendered: currentSource };
      state[stateKey] = entry;
    } else if (!applying && currentSource !== entry.rendered) {
      entry.source = currentSource;
    }

    const rendered = renderTranslatedText(entry.source, getLanguage());
    entry.rendered = rendered;

    applying = true;
    try {
      if (element.tagName === "OPTGROUP") {
        if (element.getAttribute("label") !== rendered) {
          element.setAttribute("label", rendered);
        }
      } else if (element.textContent !== rendered) {
        // Native selects display OPTION textContent in their closed control and
        // popup menu. Keep the canonical value unchanged so filtering, saving,
        // encryption and financial calculations continue to use stable IDs.
        element.textContent = rendered;
      }
    } finally {
      applying = false;
    }
  }

  function processElement(element: Element) {
    if (shouldSkipElement(element)) return;

    const state = attributeState.get(element) ?? {};

    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      const current = element.getAttribute(attribute);
      if (current === null) continue;

      const existing = state[attribute];
      if (!existing) {
        state[attribute] = { source: current, rendered: current };
      } else if (!applying && current !== existing.rendered) {
        existing.source = current;
      }

      const attributeEntry = state[attribute];
      const rendered = renderTranslatedText(
        attributeEntry.source,
        getLanguage(),
      );

      attributeEntry.rendered = rendered;

      if (current !== rendered) {
        applying = true;
        element.setAttribute(attribute, rendered);
        applying = false;
      }
    }

    processNativeSelectLabel(element, state);
    attributeState.set(element, state);
  }

  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      processTextNode(node as Text);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    processElement(element);

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    );

    let child = walker.nextNode();
    while (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        processTextNode(child as Text);
      } else {
        processElement(child as Element);
      }
      child = walker.nextNode();
    }
  }

  function translateDocument() {
    if (document.body) processNode(document.body);
  }

  const observer = new MutationObserver((mutations) => {
    if (applying) return;

    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        processTextNode(mutation.target as Text);
      } else if (mutation.type === "attributes") {
        processElement(mutation.target as Element);
      } else {
        for (const added of mutation.addedNodes) {
          processNode(added);
        }
      }
    }
  });

  return {
    start() {
      translateDocument();

      if (document.body) {
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [...OBSERVED_TRANSLATABLE_ATTRIBUTES],
        });
      }
    },
    refresh() {
      translateDocument();
    },
    stop() {
      observer.disconnect();
    },
  };
}

function persistBrowserLanguage(language: FiconterLanguage) {
  const option = getLanguageOption(language);
  const root = document.documentElement;

  root.lang = option.locale;
  root.dir = option.direction;
  root.dataset.language = language;
  root.dataset.direction = option.direction;

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The cookie and current session still keep the selected language.
  }

  document.cookie =
    `${LANGUAGE_COOKIE_NAME}=${language}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageProvider({
  initialLanguage = DEFAULT_LANGUAGE,
  children,
}: {
  initialLanguage?: FiconterLanguage;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<FiconterLanguage>(() =>
    normalizeLanguage(initialLanguage),
  );

  const languageRef = useRef(language);
  const translatorRef = useRef<
    ReturnType<typeof createDocumentTranslator> | null
  >(null);

  useEffect(() => {
    languageRef.current = language;
    persistBrowserLanguage(language);

    const frame = window.requestAnimationFrame(() => {
      translatorRef.current?.refresh();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [language]);

  useEffect(() => {
    const translator = createDocumentTranslator(
      () => languageRef.current,
    );

    translatorRef.current = translator;
    translator.start();

    return () => {
      translator.stop();
      translatorRef.current = null;
    };
  }, []);

  const changeLanguage = useCallback(
    async (
      nextLanguage: FiconterLanguage,
      persistAccount = true,
    ) => {
      const normalized = normalizeLanguage(nextLanguage);

      const applyCommittedLanguage = () => {
        setLanguage(normalized);
        persistBrowserLanguage(normalized);
        window.dispatchEvent(
          new CustomEvent(LANGUAGE_CHANGED_EVENT, {
            detail: { language: normalized },
          }),
        );
      };

      if (!persistAccount) {
        applyCommittedLanguage();
        return;
      }

      // Account persistence is the only part of localization that needs
      // Supabase. Create the browser client lazily so public/static pages can
      // render and prerender even when no Supabase environment is available.
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (user) {
        const metadata = user.user_metadata ?? {};
        const existingPreferences =
          metadata.ficonter_preferences &&
          typeof metadata.ficonter_preferences === "object"
            ? (metadata.ficonter_preferences as Record<string, unknown>)
            : {};

        const { error } = await supabase.auth.updateUser({
          data: {
            ...metadata,
            ficonter_preferences: {
              ...existingPreferences,
              language: normalized,
            },
          },
        });

        if (error) throw error;
      }

      applyCommittedLanguage();
    },
    [],
  );

  const option = getLanguageOption(language);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale: option.locale,
      direction: option.direction,
      changeLanguage,
      t: (key) => translateMessage(language, key),
    }),
    [
      changeLanguage,
      language,
      option.direction,
      option.locale,
    ],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider.",
    );
  }

  return context;
}

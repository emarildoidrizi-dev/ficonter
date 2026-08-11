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
  isFiconterLanguage,
  normalizeLanguage,
  type FiconterLanguage,
} from "@/lib/i18n/config";
import { translateMessage, type TranslationKey } from "@/lib/i18n/messages";
import { translateRuntimePhrase } from "@/lib/i18n/runtimeTranslator";

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
  const translated = translateRuntimePhrase(language, normalized);

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
          attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
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

  const supabase = useMemo(() => createClient(), []);
  const languageRef = useRef(language);
  const translatorRef = useRef<
    ReturnType<typeof createDocumentTranslator> | null
  >(null);

  useEffect(() => {
    languageRef.current = language;
    persistBrowserLanguage(language);
    translatorRef.current?.refresh();
  }, [language]);

  useEffect(() => {
    const translator = createDocumentTranslator(
      () => languageRef.current,
    );

    translatorRef.current = translator;
    translator.start();

    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const cookieMatch = document.cookie.match(
        new RegExp(`(?:^|; )${LANGUAGE_COOKIE_NAME}=([^;]*)`),
      );

      const browserPreference = isFiconterLanguage(stored)
        ? stored
        : normalizeLanguage(
            cookieMatch
              ? decodeURIComponent(cookieMatch[1])
              : undefined,
          );

      if (browserPreference !== languageRef.current) {
        setLanguage(browserPreference);
      }
    } catch {
      // The default language remains active when browser storage is unavailable.
    }

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

      setLanguage(normalized);
      persistBrowserLanguage(normalized);

      window.dispatchEvent(
        new CustomEvent(LANGUAGE_CHANGED_EVENT, {
          detail: { language: normalized },
        }),
      );

      if (!persistAccount) return;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) return;

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
    },
    [supabase],
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

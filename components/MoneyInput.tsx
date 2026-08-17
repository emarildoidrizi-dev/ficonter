"use client";

import {
  forwardRef,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";

export type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

function sanitizeDraft(value: string): string {
  if (!value) return "";

  let draft = value
    .replace(/\s|\u00A0/g, "")
    .replace(/[^\d,.\-]/g, "");

  const negative = draft.startsWith("-");
  draft = draft.replace(/-/g, "");

  return `${negative ? "-" : ""}${draft}`;
}

/**
 * Shared FICONTER monetary input.
 *
 * Cross-platform rules:
 * - never uses native type="number" for money
 * - uses inputMode="decimal" so mobile devices show a numeric keyboard
 * - allows both comma and dot while the user is typing
 * - does not force locale conversion while typing
 * - final parsing/rounding happens at the save boundary
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      value,
      defaultValue,
      onValueChange,
      autoComplete = "off",
      enterKeyHint = "done",
      ...props
    },
    ref,
  ) {
    const controlled = value !== undefined;

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      const nextValue = sanitizeDraft(event.currentTarget.value);

      // Keep uncontrolled/FormData usages clean without forcing React state.
      if (!controlled && nextValue !== event.currentTarget.value) {
        event.currentTarget.value = nextValue;
      }

      onValueChange?.(nextValue);
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
      />
    );
  },
);

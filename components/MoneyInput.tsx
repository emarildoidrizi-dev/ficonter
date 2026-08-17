"use client";

import {
  forwardRef,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { sanitizeMoneyInputDraft } from "@/lib/finance/money";

export type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

/**
 * Shared FICONTER money input.
 *
 * Cross-platform contract:
 * - never uses native type="number"
 * - keeps iOS/Android decimal keyboards via inputMode="decimal"
 * - preserves comma and dot while typing
 * - leaves locale normalization to parseMoneyInput() at save time
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      value,
      defaultValue,
      onValueChange,
      onBeforeInput,
      onInput,
      autoComplete = "off",
      enterKeyHint = "done",
      ...props
    },
    ref,
  ) {
    function emit(nextValue: string) {
      onValueChange?.(sanitizeMoneyInputDraft(nextValue));
    }

    function handleBeforeInput(event: FormEvent<HTMLInputElement>) {
      onBeforeInput?.(event);
      if (event.defaultPrevented) return;

      const nativeEvent = event.nativeEvent as InputEvent;
      const separator = nativeEvent.data;

      if (
        nativeEvent.inputType !== "insertText" ||
        (separator !== "," && separator !== ".")
      ) {
        return;
      }

      const input = event.currentTarget;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const nextValue =
        input.value.slice(0, start) +
        separator +
        input.value.slice(end);

      event.preventDefault();
      emit(nextValue);

      requestAnimationFrame(() => {
        const caret = start + 1;
        input.setSelectionRange(caret, caret);
      });
    }

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      emit(event.target.value);
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        value={value}
        defaultValue={defaultValue}
        onBeforeInput={handleBeforeInput}
        onInput={onInput}
        onChange={handleChange}
      />
    );
  },
);

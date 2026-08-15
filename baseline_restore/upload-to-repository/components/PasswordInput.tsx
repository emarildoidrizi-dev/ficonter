"use client";

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type MouseEvent,
} from "react";
import { Eye, EyeOff } from "lucide-react";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput(
  {
    disabled,
    style,
    type: _type,
    ...inputProps
  },
  ref,
) {
  const [visible, setVisible] = useState(false);

  function preserveInputFocus(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  return (
    <span
      style={{
        position: "relative",
        display: "block",
        width: "100%",
      }}
    >
      <input
        {...inputProps}
        ref={ref}
        disabled={disabled}
        type={visible ? "text" : "password"}
        style={{
          ...style,
          width: "100%",
          paddingRight: "46px",
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onMouseDown={preserveInputFocus}
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          top: "50%",
          right: "10px",
          width: "34px",
          height: "34px",
          display: "grid",
          placeItems: "center",
          padding: 0,
          border: 0,
          borderRadius: "9px",
          background: "transparent",
          color: "currentColor",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 0.72,
          transform: "translateY(-50%)",
        }}
      >
        {visible ? (
          <EyeOff size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </button>
    </span>
  );
});

'use client';
import { useEffect, useRef } from "react";

/** Six boxes for a 6-digit code. Typing moves to the next box, Backspace goes back, and pasting the whole code (or the phone's one-time-code suggestion) fills every box. */
export default function OtpBoxes({ value, onChange, onComplete, disabled, autoFocus = true, label = "6-digit code", invalid }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; autoFocus?: boolean; label?: string; invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { if (autoFocus) refs.current[Math.min(value.length, 5)]?.focus(); }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps
  // after a wrong code the boxes are cleared (and were briefly disabled, which drops focus): put the cursor back in the first box
  const used = useRef(false);
  useEffect(() => {
    if (value) { used.current = true; return; }
    if (!disabled && used.current) refs.current[0]?.focus();
  }, [value, disabled]);

  function set(next: string, focus: number) {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    refs.current[Math.min(focus, 5)]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  }
  return (
    <div className={"au-otp" + (invalid ? " bad" : "")} role="group" aria-label={label}>
      {Array.from({ length: 6 }, (_, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={value[i] ?? ""} disabled={disabled}
          inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} pattern="[0-9]*" maxLength={i === 0 ? 6 : 1}
          aria-label={`Digit ${i + 1} of 6`} aria-invalid={invalid || undefined}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) { set(value.slice(0, i) + value.slice(i + 1), i); return; }
            if (typed.length > 1) { set(value.slice(0, i) + typed, i + typed.length); return; }
            set((value.slice(0, i) + typed + value.slice(i + 1)).slice(0, 6), i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) { e.preventDefault(); set(value.slice(0, i - 1), i - 1); }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { const t = e.clipboardData.getData("text").replace(/\D/g, ""); if (t) { e.preventDefault(); set(t, t.length); } }}
        />
      ))}
    </div>
  );
}

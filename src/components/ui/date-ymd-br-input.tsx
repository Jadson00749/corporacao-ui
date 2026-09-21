import * as React from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatDateYmdBR,
  maskDateYmdBR,
  parseDateYmdInput,
} from "@/lib/dateYmd";

type Props = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "min" | "max"
> & {
  /** Fonte de verdade: "" | YYYY-MM-DD. */
  value: string;
  onChange: (isoYmd: string) => void;
  /** Limites opcionais do picker nativo (YYYY-MM-DD). */
  min?: string;
  max?: string;
};

/**
 * Digitação pt-BR (DD/MM/AAAA) com valor interno YYYY-MM-DD.
 * Evita o bug do input type="date" no Windows (anos como 92026).
 */
export const DateYmdBrInput = React.forwardRef<HTMLInputElement, Props>(
  function DateYmdBrInput(
    { id, value, onChange, className, onBlur, min, max, ...rest },
    ref,
  ) {
    const [text, setText] = React.useState(() =>
      value ? formatDateYmdBR(value) : "",
    );
    const pickerRef = React.useRef<HTMLInputElement>(null);
    const typingRef = React.useRef(false);

    React.useEffect(() => {
      if (typingRef.current) return;
      setText(value ? formatDateYmdBR(value) : "");
    }, [value]);

    const emitFromText = (masked: string) => {
      const digits = masked.replace(/\D/g, "");
      if (digits.length === 0) {
        onChange("");
        return;
      }
      if (digits.length < 8) {
        if (value) onChange("");
        return;
      }
      const parsed = parseDateYmdInput(masked);
      onChange(parsed.ok ? parsed.iso : "");
    };

    const openPicker = () => {
      const el = pickerRef.current;
      if (!el) return;
      try {
        (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        el.click();
      }
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/AAAA"
          maxLength={10}
          className={cn("pr-10", className)}
          value={text}
          onChange={(e) => {
            typingRef.current = true;
            const masked = maskDateYmdBR(e.target.value);
            setText(masked);
            emitFromText(masked);
          }}
          onBlur={(e) => {
            typingRef.current = false;
            const masked = maskDateYmdBR(e.target.value);
            setText(masked);
            emitFromText(masked);
            const parsed = parseDateYmdInput(masked);
            if (parsed.ok) setText(formatDateYmdBR(parsed.iso));
            else if (masked.replace(/\D/g, "").length === 0) setText("");
            onBlur?.(e);
          }}
          {...rest}
        />

        <button
          type="button"
          tabIndex={-1}
          aria-label="Abrir calendário"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
          onClick={openPicker}
        >
          <Calendar className="w-4 h-4" />
        </button>

        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          min={min}
          max={max}
          value={value && parseDateYmdInput(value).ok ? value : ""}
          onChange={(e) => {
            const next = e.target.value;
            typingRef.current = false;
            if (!next) {
              setText("");
              onChange("");
              return;
            }
            const parsed = parseDateYmdInput(next);
            if (!parsed.ok) return;
            setText(formatDateYmdBR(parsed.iso));
            onChange(parsed.iso);
          }}
          className="sr-only"
        />
      </div>
    );
  },
);

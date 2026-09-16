import * as React from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatBirthDateBR,
  parseBirthDateInput,
  todayLocalYMD,
} from "@/lib/birthDate";

type Props = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "min" | "max"> & {
  /** Sempre string "" | YYYY-MM-DD. Não passar Date. */
  value: string;
  /** Recebe "" | YYYY-MM-DD quando a data está vazia ou completa/válida. */
  onChange: (isoYmd: string) => void;
};

/** Máscara digitável DD/MM/AAAA a partir de qualquer entrada. */
function maskBirthDateBR(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Data de nascimento com digitação fluida (DD/MM/AAAA).
 *
 * - Valor controlado do formulário continua "" | YYYY-MM-DD.
 * - Enquanto incompleta, o texto local permanece; o pai recebe "" (não inventa data).
 * - Picker nativo opcional via ícone (útil no mobile).
 */
export const BirthDateInput = React.forwardRef<HTMLInputElement, Props>(
  function BirthDateInput({ id, value, onChange, className, onBlur, ...rest }, ref) {
    const [text, setText] = React.useState(() => (value ? formatBirthDateBR(value) : ""));
    const pickerRef = React.useRef<HTMLInputElement>(null);
    const typingRef = React.useRef(false);

    // Sincroniza quando o valor externo muda (perfil, participante salvo, etc.)
    React.useEffect(() => {
      if (typingRef.current) return;
      setText(value ? formatBirthDateBR(value) : "");
    }, [value]);

    const emitFromText = (masked: string) => {
      const digits = masked.replace(/\D/g, "");
      if (digits.length === 0) {
        onChange("");
        return;
      }
      if (digits.length < 8) {
        // Incompleta: não grava ISO parcial / não força 0000 no picker nativo
        if (value) onChange("");
        return;
      }
      const parsed = parseBirthDateInput(masked);
      onChange(parsed.ok ? parsed.iso : "");
    };

    const openPicker = () => {
      const el = pickerRef.current;
      if (!el) return;
      try {
        // Chromium
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
          autoComplete="bday"
          placeholder="DD/MM/AAAA"
          maxLength={10}
          className={cn("pr-10", className)}
          value={text}
          onChange={(e) => {
            typingRef.current = true;
            const masked = maskBirthDateBR(e.target.value);
            setText(masked);
            emitFromText(masked);
          }}
          onBlur={(e) => {
            typingRef.current = false;
            const masked = maskBirthDateBR(e.target.value);
            setText(masked);
            emitFromText(masked);
            // Se completa e válida, normaliza exibição BR a partir do ISO
            const parsed = parseBirthDateInput(masked);
            if (parsed.ok) setText(formatBirthDateBR(parsed.iso));
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
          min="1900-01-01"
          max={todayLocalYMD()}
          value={value && parseBirthDateInput(value).ok ? value : ""}
          onChange={(e) => {
            const next = e.target.value;
            typingRef.current = false;
            if (!next) {
              setText("");
              onChange("");
              return;
            }
            setText(formatBirthDateBR(next));
            onChange(next);
          }}
          className="sr-only"
        />
      </div>
    );
  }
);

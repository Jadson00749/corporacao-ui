import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toBirthDateInputValue, todayLocalYMD } from "@/lib/birthDate";

type Props = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "min" | "max"> & {
  /** Sempre string "" | YYYY-MM-DD. Não passar Date. */
  value: string;
  /** Recebe exatamente e.target.value do picker nativo ("" | YYYY-MM-DD). */
  onChange: (isoYmd: string) => void;
};

/**
 * Seletor de nascimento mobile-safe.
 *
 * - Controlado só com string YYYY-MM-DD (sem round-trip Date ↔ string).
 * - onChange usa exclusivamente o valor do input nativo — nunca new Date().
 * - Cancelar no picker deixa o valor anterior (não grava "hoje").
 * - max = hoje local (não toISOString, que muda o dia perto da meia-noite no BR).
 */
export const BirthDateInput = React.forwardRef<HTMLInputElement, Props>(
  function BirthDateInput({ id, value, onChange, className, onBlur, ...rest }, ref) {
    const controlled = toBirthDateInputValue(value);

    return (
      <Input
        ref={ref}
        id={id}
        type="date"
        autoComplete="bday"
        inputMode="numeric"
        min="1900-01-01"
        max={todayLocalYMD()}
        className={cn(className)}
        value={controlled}
        onChange={(e) => {
          // Android/Chrome: o SET emite YYYY-MM-DD aqui. Não converter com Date/toISOString.
          onChange(e.target.value);
        }}
        onBlur={(e) => {
          // Alguns WebViews só consolidam o valor escolhido no blur após SET.
          const next = e.target.value;
          if (next !== controlled) onChange(next);
          onBlur?.(e);
        }}
        {...rest}
      />
    );
  }
);

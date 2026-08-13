import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LinkOption = { value: string; label: string };

export const DEFAULT_LINK_OPTIONS: LinkOption[] = [
  { value: "/provas", label: "Página de Provas" },
  { value: "/treinos", label: "Página de Treinos" },
  { value: "/fotos", label: "Página de Fotos" },
  { value: "/produtos", label: "Página de Produtos" },
  { value: "/planos", label: "Página de Planos" },
  { value: "/sobre", label: "Página Sobre" },
  { value: "/contato", label: "Página de Contato" },
  { value: "/agenda", label: "Página de Agenda" },
];

const EXTERNAL = "__external__";
const NONE = "__none__";

type Props = {
  value: string;
  onChange: (v: string) => void;
  options?: LinkOption[];
};

export const LinkPicker = ({ value, onChange, options = DEFAULT_LINK_OPTIONS }: Props) => {
  const matched = useMemo(() => options.find((o) => o.value === value), [value, options]);
  const selectValue = !value ? NONE : matched ? matched.value : EXTERNAL;
  const isExternal = selectValue === EXTERNAL;

  return (
    <div className="mt-1 space-y-2">
      <select
        className="w-full border border-input bg-background rounded-md h-10 px-3 text-sm"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NONE) onChange("");
          else if (v === EXTERNAL) onChange("https://");
          else onChange(v);
        }}
      >
        <option value={NONE}>Nenhum (banner sem link)</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        <option value={EXTERNAL}>Outro link (URL externa)</option>
      </select>

      {isExternal && (
        <div>
          <Label className="text-xs text-muted-foreground">URL completa</Label>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
};

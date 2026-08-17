import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAZIL_STATES } from "@/data/brazilStates";
import { formatCEP, formatCPF, formatPhone, onlyDigits } from "@/lib/cpf";
import { Eye, EyeOff } from "lucide-react";

/**
 * Bloco reutilizável de campos do perfil (nome, CPF, endereço etc).
 * Usado tanto no cadastro quanto na edição de Meus Dados.
 */
export const ProfileFields = ({
  showPassword = false,
  emailReadOnly = false,
}: { showPassword?: boolean; emailReadOnly?: boolean }) => {
  const { register, setValue, formState: { errors }, control } = useFormContext<any>();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const cep = useWatch({ control, name: "cep" });

  // ViaCEP autofill
  useEffect(() => {
    const digits = onlyDigits(cep || "");
    if (digits.length !== 8) return;
    let cancel = false;
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((d) => {
        if (cancel || d.erro) return;
        if (d.logradouro) setValue("street", d.logradouro, { shouldValidate: true });
        if (d.bairro) setValue("neighborhood", d.bairro, { shouldValidate: true });
        if (d.localidade) setValue("city", d.localidade, { shouldValidate: true });
        if (d.uf) setValue("state", d.uf, { shouldValidate: true });
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [cep, setValue]);

  const err = (k: string) => (errors as any)[k]?.message as string | undefined;

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="full_name">Nome completo *</Label>
        <Input id="full_name" autoComplete="name" autoCapitalize="words" {...register("full_name")} className="mt-1" />
        {err("full_name") && <p className="text-xs text-destructive mt-1">{err("full_name")}</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cpf">CPF *</Label>
          <Input
            id="cpf"
            inputMode="numeric"
            autoComplete="off"
            {...register("cpf")}
            onChange={(e) => setValue("cpf", formatCPF(e.target.value), { shouldValidate: true })}
            className="mt-1"
          />
          {err("cpf") && <p className="text-xs text-destructive mt-1">{err("cpf")}</p>}
        </div>
        <div>
          <Label htmlFor="birth_date">Data de nascimento *</Label>
          <Input id="birth_date" type="date" autoComplete="bday" {...register("birth_date")} className="mt-1" />
          {err("birth_date") && <p className="text-xs text-destructive mt-1">{err("birth_date")}</p>}
        </div>
      </div>

      <div>
        <Label>Sexo</Label>
        <div className="flex flex-wrap gap-4 mt-2">
          <label className="flex items-center gap-2 text-sm min-h-11">
            <input type="radio" value="masculino" {...register("gender")} className="w-4 h-4" /> Masculino
          </label>
          <label className="flex items-center gap-2 text-sm min-h-11">
            <input type="radio" value="feminino" {...register("gender")} className="w-4 h-4" /> Feminino
          </label>
          <label className="flex items-center gap-2 text-sm min-h-11">
            <input type="radio" value="outro" {...register("gender")} className="w-4 h-4" /> Prefiro não dizer
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...register("phone")}
            onChange={(e) => setValue("phone", formatPhone(e.target.value))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="whatsapp">Celular / WhatsApp *</Label>
          <Input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...register("whatsapp")}
            onChange={(e) => setValue("whatsapp", formatPhone(e.target.value), { shouldValidate: true })}
            className="mt-1"
          />
          {err("whatsapp") && <p className="text-xs text-destructive mt-1">{err("whatsapp")}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="email">E-mail *</Label>
        <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" readOnly={emailReadOnly} {...register("email")} className={`mt-1 ${emailReadOnly ? "bg-muted cursor-not-allowed" : ""}`} />
        {emailReadOnly && <p className="text-xs text-muted-foreground mt-1">E-mail vinculado à sua conta Google.</p>}
        {err("email") && <p className="text-xs text-destructive mt-1">{err("email")}</p>}
      </div>

      {showPassword && (
        <div>
          <Label htmlFor="password">Senha de acesso *</Label>
          <div className="relative">
            <Input id="password" type={passwordVisible ? "text" : "password"} autoComplete="new-password" {...register("password")} className="mt-1 pr-10" />
            <button
              type="button"
              onClick={() => setPasswordVisible((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(121_100%_59%)]/40 rounded-md p-1"
              aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
            >
              {passwordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {err("password") && <p className="text-xs text-destructive mt-1">{err("password")}</p>}
          <p className="text-xs text-muted-foreground mt-1">Mínimo 8 caracteres.</p>
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <h3 className="font-display font-semibold mb-3">Endereço</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <Label htmlFor="cep">CEP *</Label>
            <Input
              id="cep"
              inputMode="numeric"
              autoComplete="postal-code"
              {...register("cep")}
              onChange={(e) => setValue("cep", formatCEP(e.target.value), { shouldValidate: true })}
              className="mt-1"
            />
            {err("cep") && <p className="text-xs text-destructive mt-1">{err("cep")}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="street">Rua / Logradouro *</Label>
            <Input id="street" autoComplete="address-line1" {...register("street")} className="mt-1" />
            {err("street") && <p className="text-xs text-destructive mt-1">{err("street")}</p>}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <Label htmlFor="number">Número *</Label>
            <Input id="number" inputMode="numeric" autoComplete="address-line2" {...register("number")} className="mt-1" />
            {err("number") && <p className="text-xs text-destructive mt-1">{err("number")}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input id="complement" autoComplete="address-line3" {...register("complement")} className="mt-1" />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <Label htmlFor="neighborhood">Bairro *</Label>
            <Input id="neighborhood" autoComplete="address-level3" {...register("neighborhood")} className="mt-1" />
            {err("neighborhood") && <p className="text-xs text-destructive mt-1">{err("neighborhood")}</p>}
          </div>
          <div>
            <Label htmlFor="city">Cidade *</Label>
            <Input id="city" autoComplete="address-level2" {...register("city")} className="mt-1" />
            {err("city") && <p className="text-xs text-destructive mt-1">{err("city")}</p>}
          </div>
          <div>
            <Label>Estado *</Label>
            <UFSelect />
            {err("state") && <p className="text-xs text-destructive mt-1">{err("state")}</p>}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="font-display font-semibold mb-3">Outros dados</h3>
        <div>
          <Label htmlFor="team_name">Nome da equipe</Label>
          <Input id="team_name" {...register("team_name")} className="mt-1" />
        </div>
        <label className="flex items-start gap-2 mt-4 text-sm">
          <input type="checkbox" {...register("accepts_marketing")} className="mt-1" />
          <span>Desejo receber informações de lançamentos e promoções.</span>
        </label>
      </div>
    </div>
  );
};

const UFSelect = () => {
  const { setValue, watch } = useFormContext<any>();
  const value = watch("state") || "";
  return (
    <Select value={value} onValueChange={(v) => setValue("state", v, { shouldValidate: true })}>
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        {BRAZIL_STATES.map((s) => (
          <SelectItem key={s.uf} value={s.uf}>{s.uf} - {s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

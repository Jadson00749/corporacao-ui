import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { useTrainings, useEvents } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, MapPin, Trophy, Dumbbell } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { format, isSameDay, isSameMonth, parseISO } from "date-fns";
import { Link } from "@/lib/router-compat";

type AgendaItem = {
  id: string;
  type: "treino" | "prova";
  title: string;
  date: Date;
  location: string;
  time?: string;
  href?: string;
};

export const AgendaCalendar = () => {
  const { data: trainings = [], isLoading: loadingT } = useTrainings();
  const { data: events = [], isLoading: loadingE } = useEvents();
  const [month, setMonth] = useState<Date>(new Date());

  const items = useMemo<AgendaItem[]>(() => {
    const t: AgendaItem[] = trainings.map((tr) => ({
      id: `t-${tr.id}`,
      type: "treino",
      title: tr.title,
      date: parseISO(tr.date),
      location: tr.location,
      time: tr.time,
      href: `/treinos#treino-${tr.id}`,
    }));
    const e: AgendaItem[] = events.map((ev) => ({
      id: `e-${ev.id}`,
      type: "prova",
      title: ev.name,
      date: parseISO(ev.date),
      location: ev.city,
      href: `/provas/${ev.id}`,
    }));
    return [...t, ...e].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [trainings, events]);

  const trainingDays = useMemo(() => items.filter((i) => i.type === "treino").map((i) => i.date), [items]);
  const eventDays = useMemo(() => items.filter((i) => i.type === "prova").map((i) => i.date), [items]);

  const monthItems = items.filter((i) => isSameMonth(i.date, month));

  if (loadingT || loadingE) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-brand" />
          <h3 className="font-display text-xl font-bold">Agenda do mês</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-brand inline-block" /> Treino</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-warning inline-block" /> Prova</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        <div className="hidden lg:flex justify-center lg:justify-start">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            locale={ptBR}
            showOutsideDays
            modifiers={{ treino: trainingDays, prova: eventDays }}
            modifiersClassNames={{
              treino:
                "relative after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-brand",
              prova:
                "relative before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:top-1 before:w-1.5 before:h-1.5 before:rounded-full before:bg-warning",
            }}
            className="p-3 pointer-events-auto rounded-xl border border-border bg-background"
          />
        </div>

        <div className="min-w-0">
          <h4 className="font-semibold mb-3 capitalize">
            {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          </h4>
          {monthItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem treinos ou provas neste mês.</p>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {monthItems.map((it) => {
                const Wrapper: any = it.href ? Link : "div";
                const wrapperProps: any = it.href ? { to: it.href } : {};
                return (
                  <li key={it.id}>
                    <Wrapper
                      {...wrapperProps}
                      className={`flex items-start gap-3 p-3 rounded-lg border border-border bg-background/50 ${it.href ? "hover:border-brand transition-colors" : ""}`}
                    >
                      <div className="flex flex-col items-center justify-center min-w-[44px] py-1 rounded-md bg-secondary text-foreground">
                        <span className="text-xs uppercase font-semibold leading-none">
                          {format(it.date, "MMM", { locale: ptBR })}
                        </span>
                        <span className="font-display text-lg font-bold leading-none mt-0.5">
                          {format(it.date, "dd")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {it.type === "treino" ? (
                            <Dumbbell className="w-3.5 h-3.5 text-brand shrink-0" />
                          ) : (
                            <Trophy className="w-3.5 h-3.5 text-warning shrink-0" />
                          )}
                          <span className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">
                            {it.type}
                          </span>
                        </div>
                        <p className="font-semibold text-sm truncate">{it.title}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          {it.time && <span>{it.time}</span>}
                          {it.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{it.location}</span>
                          )}
                        </div>
                      </div>
                    </Wrapper>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

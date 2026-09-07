import { Link } from "@/lib/router-compat";
import { ArrowRight, CalendarPlus, ClipboardList, Tent, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuickAction = {
  id: string;
  label: string;
  to: string;
  icon?: "events" | "signups" | "structure" | "new";
};

const icons = {
  events: Trophy,
  signups: ClipboardList,
  structure: Tent,
  new: CalendarPlus,
};

type Props = {
  actions: QuickAction[];
  className?: string;
};

export function DashboardQuickActions({ actions, className }: Props) {
  if (!actions.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {actions.map((a) => {
        const Icon = a.icon ? icons[a.icon] : ArrowRight;
        return (
          <Button key={a.id} asChild variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs">
            <Link to={a.to}>
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

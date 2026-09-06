import { NavLink } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/admin/organizers", label: "Organizadores" },
  { to: "/admin/rental-items", label: "Estruturas" },
  { to: "/admin/rental-orders", label: "Pedidos de Locação" },
];

export const OrganizersTabs = () => (
  <div className="flex flex-wrap items-center gap-2 mb-6">
    {tabs.map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        end
        className={({ isActive }) =>
          cn(
            "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
            isActive
              ? "border-brand bg-brand/15 text-brand"
              : "border-border text-muted-foreground hover:text-foreground"
          )
        }
      >
        {t.label}
      </NavLink>
    ))}
  </div>
);

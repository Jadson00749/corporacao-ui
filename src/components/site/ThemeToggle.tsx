import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type Props = {
  /**
   * When true, the toggle is rendered with light-on-dark colors
   * (used over the transparent navbar above the hero).
   */
  onDark?: boolean;
  className?: string;
};

export const ThemeToggle = ({ onDark, className }: Props) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className={cn(
        "inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors",
        onDark
          ? "text-white/90 hover:text-white hover:bg-white/10"
          : "text-foreground/80 hover:text-foreground hover:bg-secondary",
        className
      )}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};

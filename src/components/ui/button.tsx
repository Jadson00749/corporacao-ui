import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const FILL_VARIANTS = new Set(["brand", "partner", "hero"]);

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,box-shadow,transform,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] active:opacity-90",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100 active:opacity-80",
        /** CTA Corporação — idle discreto; verde só no hover (fill L→R). */
        brand:
          "relative isolate overflow-hidden border border-brand/45 bg-white/[0.04] text-foreground shadow-none btn-fill-hover btn-fill-brand hover:border-brand/80 hover:shadow-none",
        /** CTA parceiro — idle discreto; azul só no hover (fill L→R). */
        partner:
          "relative isolate overflow-hidden border border-partner/45 bg-white/[0.04] text-foreground shadow-none btn-fill-hover btn-fill-partner hover:border-partner/80 hover:shadow-none",
        hero:
          "relative isolate overflow-hidden border border-brand/45 bg-white/[0.04] text-foreground shadow-none btn-fill-hover btn-fill-brand hover:border-brand/80 hover:shadow-none hover:scale-[1.01]",
        outlineLight: "border-2 border-brand/70 text-white bg-white/5 backdrop-blur-sm hover:bg-brand hover:text-brand-foreground hover:border-brand",
        whatsapp: "bg-success text-white hover:bg-success/90 shadow-card",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-8 text-base",
        xl: "h-14 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/** Mantém label+ícone acima do ::before (nós de texto sozinhos não recebem z-index). */
const FillLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="relative z-10 inline-flex items-center justify-center gap-2 text-current [&_svg]:text-current">
    {children}
  </span>
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const useFill = FILL_VARIANTS.has(variant ?? "");

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
      }>;
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {useFill
            ? React.cloneElement(child, {
                children: <FillLabel>{child.props.children}</FillLabel>,
              })
            : child}
        </Slot>
      );
    }

    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {useFill ? <FillLabel>{children}</FillLabel> : children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

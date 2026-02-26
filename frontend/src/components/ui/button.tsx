import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-semibold uppercase tracking-[0.11em] transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-ink)] hover:bg-slate-800",
        secondary: "bg-[var(--bg-muted)] text-[var(--ink)] hover:bg-slate-200",
        outline: "border border-[var(--border-strong)] bg-white text-[var(--ink)] hover:bg-[var(--bg-muted)]",
        ghost: "text-[var(--ink-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink)]",
        destructive: "bg-[var(--danger)] text-white hover:bg-red-700",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-[11px]",
        lg: "h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ComponentPropsWithoutRef<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<React.ElementRef<"button">, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };

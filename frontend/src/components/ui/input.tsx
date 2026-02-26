import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-lg border-0 bg-slate-100 px-3 py-2 text-xs text-[var(--ink)] shadow-none placeholder:text-[var(--ink-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };

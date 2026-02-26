import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.11em]", {
  variants: {
    variant: {
      default: "bg-[var(--chip)] text-[var(--ink)]",
      critical: "bg-[#7f1d1d] text-white",
      high: "bg-[#9f1239] text-white",
      medium: "bg-[#b45309] text-white",
      low: "bg-[#166534] text-white",
      info: "bg-[#0f4c81] text-white",
      success: "bg-[#166534] text-white",
      warning: "bg-[#9a3412] text-white",
      danger: "bg-[#b91c1c] text-white",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

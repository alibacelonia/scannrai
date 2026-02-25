import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-[var(--muted)] text-[var(--ink)]",
      critical: "bg-[#5a0d16] text-white",
      high: "bg-[#8a271a] text-white",
      medium: "bg-[#b76f18] text-white",
      low: "bg-[#166a4f] text-white",
      info: "bg-[#0f4f7f] text-white",
      success: "bg-[#14532d] text-white",
      warning: "bg-[#854d0e] text-white",
      danger: "bg-[#7f1d1d] text-white",
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

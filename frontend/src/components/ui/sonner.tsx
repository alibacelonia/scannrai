"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-slate-200 bg-white text-slate-900",
          title: "text-xs font-semibold",
          description: "text-xs text-slate-600",
          actionButton: "bg-slate-900 text-white",
          cancelButton: "bg-slate-100 text-slate-700",
        },
      }}
      {...props}
    />
  );
}

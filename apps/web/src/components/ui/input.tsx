import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-600 focus:shadow-[0_0_0_3px_rgba(13,148,136,0.15)]",
        className,
      )}
      {...props}
    />
  );
}

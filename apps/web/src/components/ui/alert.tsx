import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border px-3 py-2 text-sm", className)} {...props} />;
}

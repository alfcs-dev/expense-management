import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export function PageShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("page page-stack", className)} {...props} />;
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="section-stack">
      <h1>{title}</h1>
      {description ? <p className="muted">{description}</p> : null}
    </header>
  );
}

export function Section({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("panel section-stack", className)} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

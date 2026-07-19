import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-primary truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</div>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-premium p-10 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

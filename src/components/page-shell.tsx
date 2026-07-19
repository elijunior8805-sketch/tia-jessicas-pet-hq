import type { ReactNode, ComponentType } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   Page shell premium — reutilizado por todas as rotas
   ============================================================ */

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6", className)}>
      {children}
    </div>
  );
}

/* ============================================================
   PageHeader — hero verde-floresta com detalhe dourado
   ------------------------------------------------------------
   Uso:
     <PageHeader
       title="Clientes e Pets"
       description="Gerencie tutores, pets e relacionamento."
       icon={Users}
       actions={<Button>+ Novo</Button>}
       stats={[{label:"Total", value:"124"}, {label:"VIP", value:"18", accent:"gold"}]}
     />
   ============================================================ */

type StatAccent = "default" | "gold" | "emerald" | "terracotta" | "sage";

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  stats,
  variant = "forest",
  className,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  stats?: Array<{ label: string; value: ReactNode; accent?: StatAccent; hint?: string }>;
  variant?: "forest" | "light";
  className?: string;
}) {
  const dark = variant === "forest";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-[var(--shadow-elegant)]",
        dark
          ? "gradient-forest paw-watermark border-transparent"
          : "bg-card border-border",
        className,
      )}
    >
      {/* faixa dourada superior */}
      <div className="absolute inset-x-0 top-0 h-[3px] gradient-gold-shine" />

      <div className="relative p-5 sm:p-7 lg:p-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0 flex items-start gap-3 sm:gap-4">
            {Icon && (
              <div
                className={cn(
                  "grid h-11 w-11 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-xl border shadow-sm",
                  dark
                    ? "bg-white/10 border-white/15 text-[var(--color-gold)]"
                    : "bg-primary/8 border-primary/15 text-primary",
                )}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            )}
            <div className="min-w-0">
              <h1
                className={cn(
                  "font-display font-semibold tracking-tight text-2xl sm:text-3xl lg:text-[2rem] leading-tight truncate",
                  dark ? "text-white" : "text-primary",
                )}
              >
                {title}
              </h1>
              {description && (
                <p
                  className={cn(
                    "mt-1 text-sm sm:text-[15px] text-balance max-w-2xl",
                    dark ? "text-white/75" : "text-muted-foreground",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div
            className={cn(
              "mt-5 grid gap-3",
              stats.length === 2
                ? "grid-cols-2"
                : stats.length === 3
                  ? "grid-cols-2 sm:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-4",
            )}
          >
            {stats.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl border px-3 py-2.5 backdrop-blur-sm",
                  dark
                    ? "bg-white/6 border-white/10"
                    : "bg-muted/40 border-border",
                )}
              >
                <div
                  className={cn(
                    "text-[10px] uppercase tracking-[0.14em] font-medium",
                    dark ? "text-white/60" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </div>
                <div
                  className={cn(
                    "font-display text-xl sm:text-2xl leading-none mt-1 truncate",
                    dark
                      ? s.accent === "gold"
                        ? "text-[var(--color-gold)]"
                        : "text-white"
                      : s.accent === "gold"
                        ? "text-[var(--color-gold)]"
                        : s.accent === "emerald"
                          ? "text-[var(--color-emerald)]"
                          : s.accent === "terracotta"
                            ? "text-[var(--color-terracotta)]"
                            : "text-primary",
                  )}
                >
                  {s.value}
                </div>
                {s.hint && (
                  <div
                    className={cn(
                      "text-[11px] mt-0.5 truncate",
                      dark ? "text-white/55" : "text-muted-foreground",
                    )}
                  >
                    {s.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   KpiCard — número grande, ícone em bloco, faixa lateral colorida
   ============================================================ */

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "forest",
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  accent?: "forest" | "gold" | "emerald" | "terracotta" | "petrol" | "sage";
  trend?: { value: string; direction: "up" | "down" | "flat" };
  className?: string;
}) {
  const stripes: Record<string, string> = {
    forest: "bg-primary",
    gold: "bg-[var(--color-gold)]",
    emerald: "bg-[var(--color-emerald)]",
    terracotta: "bg-[var(--color-terracotta)]",
    petrol: "bg-[var(--color-petrol)]",
    sage: "bg-[var(--color-sage)]",
  };
  const iconBg: Record<string, string> = {
    forest: "bg-primary/10 text-primary",
    gold: "bg-[color-mix(in_oklab,var(--color-gold)_18%,transparent)] text-[var(--color-gold)]",
    emerald: "bg-[color-mix(in_oklab,var(--color-emerald)_15%,transparent)] text-[var(--color-emerald)]",
    terracotta: "bg-[color-mix(in_oklab,var(--color-terracotta)_15%,transparent)] text-[var(--color-terracotta)]",
    petrol: "bg-[color-mix(in_oklab,var(--color-petrol)_15%,transparent)] text-[var(--color-petrol)]",
    sage: "bg-[color-mix(in_oklab,var(--color-sage)_35%,transparent)] text-[var(--color-sage-foreground)]",
  };

  const trendColor =
    trend?.direction === "up"
      ? "text-[var(--color-emerald)]"
      : trend?.direction === "down"
        ? "text-[var(--color-terracotta)]"
        : "text-muted-foreground";
  const trendArrow =
    trend?.direction === "up" ? "▲" : trend?.direction === "down" ? "▼" : "•";

  return (
    <div className={cn("relative card-premium card-hover overflow-hidden", className)}>
      <span
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-lg)]",
          stripes[accent],
        )}
      />
      <div className="p-4 sm:p-5 pl-5 sm:pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] font-medium text-muted-foreground truncate">
              {label}
            </div>
            <div className="mt-2 font-display text-2xl sm:text-[1.75rem] leading-none font-semibold text-foreground truncate">
              {value}
            </div>
            {(hint || trend) && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {trend && (
                  <span className={cn("font-medium", trendColor)}>
                    {trendArrow} {trend.value}
                  </span>
                )}
                {hint && <span className="text-muted-foreground truncate">{hint}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                iconBg[accent],
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   StatusBadge — cores contextuais unificadas
   ============================================================ */

export type StatusTone =
  | "success" // pago / confirmado
  | "warning" // pendente
  | "danger" // atrasado
  | "muted" // cancelado
  | "petrol" // concluído
  | "gold" // VIP / destaque
  | "info"; // neutro

const toneStyle: Record<StatusTone, string> = {
  success:
    "bg-[color-mix(in_oklab,var(--color-emerald)_14%,transparent)] text-[var(--color-emerald)] border-[color-mix(in_oklab,var(--color-emerald)_35%,transparent)]",
  warning:
    "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[color-mix(in_oklab,var(--color-warning)_50%,var(--color-foreground))] border-[color-mix(in_oklab,var(--color-warning)_40%,transparent)]",
  danger:
    "bg-[color-mix(in_oklab,var(--color-terracotta)_14%,transparent)] text-[var(--color-terracotta)] border-[color-mix(in_oklab,var(--color-terracotta)_38%,transparent)]",
  muted:
    "bg-muted text-muted-foreground border-border",
  petrol:
    "bg-[color-mix(in_oklab,var(--color-petrol)_14%,transparent)] text-[var(--color-petrol)] border-[color-mix(in_oklab,var(--color-petrol)_35%,transparent)]",
  gold:
    "badge-gold border-transparent",
  info:
    "bg-[color-mix(in_oklab,var(--color-sage)_35%,transparent)] text-[var(--color-sage-foreground)] border-[color-mix(in_oklab,var(--color-sage)_60%,transparent)]",
};

export function StatusBadge({
  tone = "info",
  children,
  className,
  dot = true,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap",
        toneStyle[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

/* ============================================================
   SectionCard — divide formulários longos
   ============================================================ */

export function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  actions,
  className,
}: {
  title?: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-premium overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="font-display text-sm font-semibold text-primary truncate">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-[12px] text-muted-foreground truncate">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/* ============================================================
   EmptyState — orientação + ação
   ============================================================ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-premium relative overflow-hidden p-8 sm:p-12 text-center",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] gradient-gold-shine opacity-60" />
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8 text-primary mb-4 ring-1 ring-primary/10">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="font-display text-lg sm:text-xl font-semibold text-primary">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto text-balance">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ============================================================
   Toolbar — barra de filtros/busca premium
   ============================================================ */

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-premium flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

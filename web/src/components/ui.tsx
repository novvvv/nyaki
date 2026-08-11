import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Card({
  children,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-taupe/50 bg-card/60 px-4 py-3.5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-cream transition hover:bg-umber disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PrimaryLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-cream transition hover:bg-umber ${className}`}
    >
      {children}
    </Link>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-umber/70 transition hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SubtleButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg border border-taupe/40 bg-transparent px-3 py-2 text-sm text-umber/65 transition hover:border-taupe/70 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-umber/55">
      {children}
    </label>
  );
}

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-taupe/45 bg-cream px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-ink/25 focus:ring-2 focus:ring-taupe/35 ${className}`}
      {...props}
    />
  );
}

export function TextArea({
  className = "",
  rows = 3,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={`w-full resize-y rounded-lg border border-taupe/45 bg-cream px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-ink/25 focus:ring-2 focus:ring-taupe/35 ${className}`}
      {...props}
    />
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-md border border-taupe/40 bg-subtle/70 px-2 py-0.5 text-xs font-medium text-umber/70">
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm text-umber/55">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-taupe/45 px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink/65">{title}</p>
      {description ? (
        <p className="mt-1.5 text-sm text-umber/45">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

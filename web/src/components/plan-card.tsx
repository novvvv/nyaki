"use client";

import type { Plan } from "@/lib/plans";
import { Card, GhostButton, PrimaryButton } from "@/components/ui";

function CrownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M4 18h16v2H4v-2zm1.6-9.2 2.8 3.4L12 5.5l3.6 6.7 2.8-3.4L19 16H5l.6-7.2z" />
    </svg>
  );
}

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2l1.4 4.3L18 8l-4.6 1.7L12 14l-1.4-4.3L6 8l4.6-1.7L12 2zm6 10 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3 3 1-1-3z" />
    </svg>
  );
}

function CatIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 3c-1.2 0-2.2.4-3 1.1-.8-.7-1.8-1.1-3-1.1-2.8 0-5 2.2-5 5 0 3.2 2.4 6.8 5.5 10.3.9 1 1.8 1.8 2.5 2.4V21h8v-.2c.7-.6 1.6-1.4 2.5-2.4C20.6 14.8 23 11.2 23 8c0-2.8-2.2-5-5-5zm-5 5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

function tierStyles(tier: Plan["tier"]) {
  if (tier === "free") {
    return {
      card: "border-ink/[0.08] bg-card/50 hover:border-ink/14 hover:shadow-[0_6px_28px_rgba(29,29,27,0.06)]",
      accent: "text-ink/40 group-hover:text-ink/55",
      badge: "bg-subtle text-ink/45",
      glow: "from-ink/[0.025] to-transparent",
      dot: "bg-ink/20",
    };
  }
  if (tier === "pro") {
    return {
      card: "border-ink/[0.08] bg-card/50 hover:border-ink/20 hover:shadow-[0_10px_40px_rgba(29,29,27,0.08)]",
      accent: "text-ink/70",
      badge: "bg-ink text-cream",
      glow: "from-ink/[0.03] to-transparent",
      dot: "bg-ink/25",
    };
  }
  return {
    card: "border-amber-900/10 bg-[linear-gradient(180deg,#faf6ec_0%,#f5f0e4_100%)] hover:border-amber-900/25 hover:shadow-[0_12px_44px_rgba(146,110,40,0.14)]",
    accent: "text-amber-900/75 plan-shimmer",
    badge: "bg-amber-900/90 text-[#faf6ec]",
    glow: "from-amber-900/[0.06] to-transparent",
    dot: "bg-amber-900/30",
  };
}

export function PlanCard({ plan }: { plan: Plan }) {
  const styles = tierStyles(plan.tier);
  const isFree = plan.tier === "free";

  return (
    <Card
      className={`group relative flex h-full min-h-[400px] flex-col px-5 py-6 transition duration-300 ${styles.card} ${
        plan.highlight ? "border-ink/15 shadow-[0_1px_0_rgba(29,29,27,0.04)]" : ""
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${styles.glow} opacity-0 transition duration-300 group-hover:opacity-100`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {plan.tier === "free" ? (
              <CatIcon className={`h-4 w-4 shrink-0 transition duration-300 ${styles.accent}`} />
            ) : null}
            {plan.tier === "pro" ? (
              <CrownIcon className={`h-4 w-4 shrink-0 transition duration-300 ${styles.accent}`} />
            ) : null}
            {plan.tier === "premium" ? (
              <span className="relative flex shrink-0 items-center">
                <CrownIcon className={`h-4 w-4 transition duration-300 ${styles.accent}`} />
                <SparkleIcon className="absolute -right-2 -top-1 h-2.5 w-2.5 text-amber-800/50 opacity-0 transition group-hover:opacity-100" />
              </span>
            ) : null}
            <h3 className="text-lg font-semibold tracking-tight text-ink">
              {plan.name}
            </h3>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-ink/45">
            {plan.tagline}
          </p>
        </div>
        {plan.badge ? (
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}
          >
            {plan.badge}
          </span>
        ) : null}
      </div>

      <div className="relative mt-6">
        <p className="text-[1.75rem] font-semibold leading-none tracking-tight text-ink">
          {plan.price}
        </p>
        <p className="mt-1.5 text-xs text-ink/35">{plan.priceNote}</p>
      </div>

      <ul className="mt-7 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature.label} className="flex gap-2.5">
            <span className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${styles.dot}`} />
            <p className="text-[13px] leading-[1.45] text-ink/70">
              {feature.label}
              {feature.hint ? (
                <span className="plan-card-hint text-ink/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {" — "}
                  {feature.hint}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {isFree ? (
          <PrimaryButton className="h-10 w-full" disabled>
            현재 플랜
          </PrimaryButton>
        ) : (
          <GhostButton
            className="h-10 w-full text-ink/40 transition group-hover:border-ink/10 group-hover:bg-subtle group-hover:text-ink/55"
            disabled
          >
            {plan.comingSoon || plan.tier === "premium"
              ? "준비 중"
              : "결제 준비 중"}
          </GhostButton>
        )}
      </div>
    </Card>
  );
}

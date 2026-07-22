import { PlanCard } from "@/components/plan-card";
import { PLANS } from "@/lib/plans";

export function PricingSection() {
  return (
    <section
      id="plans"
      className="scroll-mt-14 border-t border-ink/[0.06] bg-subtle/30 px-6 py-16"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink/35">
            Plans
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            나에게 맞는 플랜
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/45">
            앱에서는 로컬 학습을, 웹에서는 클라우드 단어장을.
            <br className="hidden sm:inline" />
            Drive는 백업용이며 Hub와는 별도입니다.
          </p>
          <p className="mt-2 hidden text-xs text-ink/30 sm:block">
            카드에 마우스를 올리면 짧은 설명이 더 나와요
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

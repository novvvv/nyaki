import { PlanCard } from "@/components/plan-card";
import { PLANS } from "@/lib/plans";

export function PricingSection() {
  return (
    <section
      id="plans"
      className="scroll-mt-14 border-t border-ink/[0.06] bg-subtle/30 px-6 py-20"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink/35">
            Plans
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
            나에게 맞는 플랜
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/45">
            앱 로컬은 자유롭게, 클라우드·냥키는 플랜에 맞게.
            <br className="hidden sm:inline" />
            Drive 백업은 Hub와 별도로 동작합니다.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 items-stretch gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

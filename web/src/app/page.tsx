"use client";

// import { PricingSection } from "@/components/pricing-section"; // 플랜 섹션 일단 주석처리

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center px-6 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cat.png"
        alt="Nyaki 고양이"
        width={500}
        height={500}
        className="block h-auto w-[min(220px,58vw)]"
      />

      {/* <PricingSection /> 플랜 섹션 일단 주석처리 */}
    </main>
  );
}

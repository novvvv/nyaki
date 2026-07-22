"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { HomeNav } from "@/components/home-nav";
import { PricingSection } from "@/components/pricing-section";

export default function HomePage() {
  const { user, signOutUser } = useAuth();
  const name = user?.displayName?.split(" ")[0] ?? user?.email ?? null;

  return (
    <div className="min-h-screen">
      <HomeNav onSignOut={() => void signOutUser()} />

      <main>
        <section className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-12">
          <div className="flex w-full max-w-[340px] flex-col items-center text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink/35">
              Vocabulary, calmly
            </p>
            <h1 className="mt-2.5 text-[2.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
              Nyaki
            </h1>
            {name ? (
              <p className="mt-3 text-[15px] text-ink/45">{name}</p>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cat.png"
              alt="Nyaki 고양이"
              width={500}
              height={500}
              className="mt-8 block h-auto w-[min(260px,68vw)]"
            />

            <Link
              href="/word-books"
              className="mt-8 text-sm text-ink/40 transition hover:text-ink/70"
            >
              내 단어장
            </Link>
          </div>
        </section>

        <PricingSection />
      </main>
    </div>
  );
}

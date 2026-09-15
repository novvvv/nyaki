"use client";

import { AuthProvider } from "./auth-provider";
import { AuthGate } from "./auth-gate";
import { Footer } from "./footer";
import { SiteHeader } from "./site-header";
import { VocabProvider } from "@/lib/vocab-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VocabProvider>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />

          <div className="bg-ink text-cream">
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-6 py-2 text-center text-xs">
              <span aria-hidden>/ᐠ .⑅.ᐟ\ﾉ</span>
              <span>아직 만드는 중이냥, 조금만 기다려 달라냥</span>
            </div>
          </div>

          <div className="min-h-[calc(100vh-8.5rem)] flex-1">
            <AuthGate>{children}</AuthGate>
          </div>
          <Footer />
        </div>
      </VocabProvider>
    </AuthProvider>
  );
}

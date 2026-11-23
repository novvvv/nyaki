"use client";

import { AppTopBar } from "./app-top-bar";
import { AuthProvider } from "./auth-provider";
import { AuthGate } from "./auth-gate";
import { Footer } from "./footer";
import { MobileTabBar } from "./mobile-tab-bar";
import { SiteHeader } from "./site-header";
import { useServiceWorker } from "@/lib/pwa";
import { VocabProvider } from "@/lib/vocab-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useServiceWorker();

  return (
    <AuthProvider>
      <VocabProvider>
        {/* 폰 크기에서는 아래 탭 바만큼 띄운다 — 마지막 줄이 가려지지 않게.
            app-shell · web-only · app-only — 앱 모드의 틀(globals.css). */}
        <div className="app-shell flex min-h-screen flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          <SiteHeader />
          <AppTopBar />

          {/* nyaki-band — 다크에서도 어두운 띠로 둔다(globals.css) */}
          <div className="web-only nyaki-band bg-ink text-cream">
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-6 py-2 text-center text-xs">
              <span aria-hidden>/ᐠ .⑅.ᐟ\ﾉ</span>
              <span>아직 만드는 중이냥, 조금만 기다려 달라냥</span>
            </div>
          </div>

          <div className="min-h-[calc(100vh-8.5rem)] flex-1 app:min-h-0">
            <AuthGate>{children}</AuthGate>
          </div>
          <div className="web-only">
            <Footer />
          </div>
        </div>
        <MobileTabBar />
      </VocabProvider>
    </AuthProvider>
  );
}

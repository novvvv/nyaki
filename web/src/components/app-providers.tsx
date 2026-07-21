"use client";

import { AuthProvider } from "./auth-provider";
import { AuthGate } from "./auth-gate";
import { VocabProvider } from "@/lib/vocab-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VocabProvider>
        <AuthGate>{children}</AuthGate>
      </VocabProvider>
    </AuthProvider>
  );
}

"use client";

import { PageHeader } from "@/components/ui";
import { useAppMode } from "@/lib/app-mode";
import {
  NYAKI_SKINS,
  nyakiImage,
  setNyakiSkin,
  useNyakiSkin,
} from "@/lib/nyaki-skin";
import { cn } from "@/lib/utils";

/**
 * 상점 — 냐키 옷을 고른다. 지금은 모두 무료이고, 고른 옷은 이 기기에만 저장된다.
 * 고르면 메인 · 오늘 · 테스트 · 통계 · 마이페이지의 냐키가 모두 바뀐다.
 */
export default function ShopPage() {
  const appMode = useAppMode();
  const current = useNyakiSkin();

  const grid = (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
      {NYAKI_SKINS.map((skin) => {
        const on = skin.id === current;
        return (
          <li key={skin.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => setNyakiSkin(skin.id)}
              className={cn(
                "group flex w-full flex-col overflow-hidden rounded-3xl border text-left transition",
                on
                  ? "border-ink/80 shadow-[0_6px_0_-1px_#efd6d6]"
                  : "border-taupe/70 hover:border-ink/40",
              )}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(160deg,#f7e9e9_0%,#efd6d6_100%)] dark:bg-[linear-gradient(160deg,rgba(239,214,214,0.18)_0%,rgba(239,214,214,0.08)_100%)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={nyakiImage(skin.id, "normal")}
                  alt=""
                  width={900}
                  height={1206}
                  className="absolute -bottom-6 left-1/2 w-[92%] -translate-x-1/2 transition duration-300 group-hover:-translate-y-1"
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-taupe/50 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {skin.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/45">무료</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    on
                      ? "bg-[#efd6d6] text-ink"
                      : "bg-ink text-cream group-hover:bg-ink/85",
                  )}
                >
                  {on ? "적용됨" : "적용"}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (appMode) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-10 pt-5 break-keep">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">
            상점
          </h1>
          <p className="mt-1 text-xs text-ink/45">
            냐키 옷을 골라 보세요. 이 기기에 저장돼요.
          </p>
        </div>
        {grid}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl break-keep px-8 py-14 lg:px-12">
      <PageHeader
        title="상점"
        description="냐키 옷을 골라 보세요. 이 기기에 저장돼요."
      />
      {grid}
    </main>
  );
}

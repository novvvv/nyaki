"use client";

import { useState } from "react";

import { promptInstall, useInstallState } from "@/lib/pwa";

/**
 * "앱 다운로드" — 이 사이트를 홈 화면에 앱으로 설치한다.
 * 브라우저가 설치 창을 줄 수 있으면 바로 띄우고, 아니면 방법을 알려 준다.
 * 이미 앱으로 열었다면 그리지 않는다.
 */
export function InstallButton() {
  const state = useInstallState();
  const [hint, setHint] = useState<string>();

  if (state === "installed" || state === "unknown") return null;

  async function handleClick() {
    if (await promptInstall()) {
      setHint(undefined);
      return;
    }
    setHint(
      state === "ios"
        ? "Safari 아래쪽 공유 버튼 → ‘홈 화면에 추가’를 눌러 주세요."
        : "브라우저 주소창의 설치 아이콘이나 메뉴(⋮) → ‘앱 설치’를 눌러 주세요.",
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex items-center gap-2 rounded-lg border border-ink bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-ink/85"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
        </svg>
        앱 다운로드
      </button>
      {hint ? (
        <p className="max-w-[260px] text-xs leading-relaxed text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

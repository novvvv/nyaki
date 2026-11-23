"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * 앱 설치(PWA). 브라우저가 "설치할 수 있다"고 알려 주는 beforeinstallprompt는
 * 페이지가 뜨자마자 한 번만 온다 — 버튼이 그려지기 전일 수 있어서 모듈에서
 * 바로 받아 둔다.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** 홈 화면에서 연 앱인가. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export type InstallState =
  /** 서버에서 그리는 중 — 아직 모른다. */
  | "unknown"
  /** 이미 앱으로 열었거나 방금 설치했다. */
  | "installed"
  /** 버튼을 누르면 브라우저 설치 창이 뜬다. */
  | "prompt"
  /** 아이폰 · 아이패드 — 공유 → 홈 화면에 추가로 안내한다. */
  | "ios"
  /** 그 밖 — 브라우저 메뉴에서 설치하도록 안내한다. */
  | "manual";

function snapshot(): InstallState {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  return isIOS() ? "ios" : "manual";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, snapshot, () => "unknown");
}

/** 브라우저 설치 창을 띄운다. 띄울 수 없으면 false. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  notify();
  return true;
}

/** 서비스 워커 등록 — 설치 조건이자, 끊겼을 때 마지막 화면을 보여 준다. */
export function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // 개발 서버에서는 캐시가 새 코드를 가린다.
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}

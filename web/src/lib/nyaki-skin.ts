"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 냐키 옷(스킨) — 상점에서 고른다. 고른 값은 이 기기(localStorage)에만 둔다.
 * 그림은 public/nyaki/{스킨}/{표정}.webp — 스킨마다 표정 네 장이 같은 이름으로 있다.
 */
export type NyakiSkin = "default" | "santa";
export type NyakiMood = "normal" | "happy" | "angry" | "fighting";

export const NYAKI_SKINS: readonly { id: NyakiSkin; name: string }[] = [
  { id: "default", name: "기본 냐키" },
  { id: "santa", name: "산타 냐키" },
];

const KEY = "nyaki.skin";
/** 같은 탭 안에서 바꿨을 때 알리는 이벤트 — storage 이벤트는 다른 탭에만 간다. */
const EVENT = "nyaki-skin-change";

function isSkin(value: unknown): value is NyakiSkin {
  return NYAKI_SKINS.some((skin) => skin.id === value);
}

function read(): NyakiSkin {
  try {
    const value = window.localStorage.getItem(KEY);
    return isSkin(value) ? value : "default";
  } catch {
    return "default";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setNyakiSkin(skin: NyakiSkin) {
  try {
    window.localStorage.setItem(KEY, skin);
  } catch {
    // 저장이 막힌 브라우저 — 이 화면에서만 바뀐다.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function nyakiImage(skin: NyakiSkin, mood: NyakiMood): string {
  return `/nyaki/${skin}/${mood}.webp`;
}

/** 지금 고른 스킨. 서버에서 그릴 때는 기본이다. */
export function useNyakiSkin(): NyakiSkin {
  return useSyncExternalStore(subscribe, read, () => "default");
}

/** 표정을 주면 지금 스킨의 그림 주소를 준다. */
export function useNyakiImage(): (mood: NyakiMood) => string {
  const skin = useNyakiSkin();
  return useCallback((mood: NyakiMood) => nyakiImage(skin, mood), [skin]);
}

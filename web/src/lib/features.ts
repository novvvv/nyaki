"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { fetchFeatures, type Features } from "@/lib/api-client";

const LOCKED: Features = { cardPhotos: false };
/** 계정마다 한 번만 묻는다 — 화면을 옮길 때마다 서버에 가지 않게. */
const cache = new Map<string, Promise<Features>>();

/**
 * 이 계정이 쓸 수 있는 유료 기능. 모르는 동안(null)과 못 받았을 때는 잠긴 것으로 본다.
 * 화면을 여닫는 용도일 뿐이다 — 실제로 막는 건 서버다.
 */
export function useFeatures(): Features | null {
  const { user, getToken } = useAuth();
  const [features, setFeatures] = useState<Features | null>(null);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    let pending = cache.get(uid);
    if (!pending) {
      pending = getToken()
        .then((token) => (token ? fetchFeatures(token) : LOCKED))
        .catch(() => {
          cache.delete(uid);
          return LOCKED;
        });
      cache.set(uid, pending);
    }
    void pending.then((value) => {
      if (!cancelled) setFeatures(value);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, getToken]);

  return uid ? features : LOCKED;
}

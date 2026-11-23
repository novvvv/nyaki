"use client";

import { useSyncExternalStore } from "react";

/**
 * 앱 모드 — 홈 화면에 설치해서 열었거나, 메인 화면의 폰 미리보기(iframe) 안이다.
 * 이때만 <html class="app">을 달고, 웹 머리말 · 푸터 대신 앱 화면을 쓴다.
 * 넓은 화면 웹과 폰 브라우저는 그대로다.
 *
 * ?app=1 — 브라우저에서 앱 화면을 확인할 때. 이번 탭에서만 유지된다.
 * ?app=0 — 끈다.
 *
 * 그리기 전에 달아야 웹 머리말이 번쩍 보였다 사라지지 않는다 — layout.tsx가
 * <head>에서 실행한다.
 */
export const APP_MODE_SCRIPT = `(function(){try{var d=document.documentElement,k="nyaki-app",q=new URLSearchParams(location.search).get("app");if(q==="1")sessionStorage.setItem(k,"1");if(q==="0")sessionStorage.removeItem(k);var s=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true,f=window.self!==window.top;if(s||f||sessionStorage.getItem(k)==="1")d.classList.add("app")}catch(e){}})()`;

function snapshot(): boolean {
  return document.documentElement.classList.contains("app");
}

// 클래스는 처음 그리기 전에 정해지고 바뀌지 않는다 — 구독할 일이 없다.
const subscribe = () => () => {};

/** 앱 모드인가. 서버에서 그릴 때는 false다. */
export function useAppMode(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

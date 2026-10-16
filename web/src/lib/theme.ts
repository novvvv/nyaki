/**
 * 화면 테마 — 시스템 / 라이트 / 다크. 마이페이지에서 고른다.
 *
 * 기기마다 다른 화면 설정이라 서버에 두지 않았다 — 테스트 화면 스킨과 같다.
 * 적용은 <html>의 dark 클래스 하나로 한다. 색은 globals.css의 다크 토큰이 바꾼다.
 *
 * 페이지가 그려지기 전에 layout.tsx가 THEME_SCRIPT로 같은 일을 먼저 한다 —
 * 리액트가 뜬 뒤에 바꾸면 다크인 사람에게 흰 화면이 한 번 번쩍인다. 그래서
 * 규칙이 두 군데 있다. 하나를 고치면 다른 하나도 고친다.
 */

export type Theme = "system" | "light" | "dark";

const THEME_KEY = "nyaki.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function loadTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** 고른 테마를 저장하고 바로 칠한다. */
export function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 이번 방문 동안만 적용된다.
  }
  applyTheme(theme);
}

export function applyTheme(theme: Theme = loadTheme()) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * <head>에 그대로 넣는 스크립트. applyTheme과 같은 규칙이다. 시스템을 따르는
 * 동안 폰·맥 설정이 바뀌면(해 질 때 자동 전환 등) 새로고침 없이 따라간다.
 */
export const THEME_SCRIPT = `(function(){var m=window.matchMedia(${JSON.stringify(DARK_QUERY)});function a(){var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}document.documentElement.classList.toggle("dark",t==="dark"||(t!=="light"&&m.matches))}a();m.addEventListener("change",a)})()`;

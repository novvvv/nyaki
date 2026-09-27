/**
 * 복습 세션의 순수 계산.
 *
 * 화면 컴포넌트에서 떼어낸 이유는 테스트 때문이다 — 이 계산이 틀리면 잘못된
 * 간격이 조용히 표시되거나 카드가 세션에서 사라진다. 눈으로 잡기 어렵다.
 */

/** 초 → 사람이 읽는 간격. 채점 버튼 위에 띄운다. */
export function formatDelay(seconds: number): string {
  if (seconds <= 30) return "즉시";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.round(seconds / 86400)}일`;
}

/** Fisher-Yates. 원본은 건드리지 않는다. */
export function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const DELAY_HINT_KEY = "nyaki.review.showDelays";

/**
 * 채점 버튼 위에 "즉시 / 10분"을 띄울지.
 *
 * **기본은 꺼짐.** 다음에 언제 나오는지가 보이면 답을 떠올리는 대신 간격이 긴
 * 쪽을 고르게 된다. 필요한 사람만 마이페이지에서 켠다.
 *
 * 기기마다 다른 화면 설정이라 서버에 두지 않았다. 브라우저에만 남는다.
 */
export function loadShowDelays(): boolean {
  try {
    return window.localStorage.getItem(DELAY_HINT_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveShowDelays(on: boolean) {
  try {
    window.localStorage.setItem(DELAY_HINT_KEY, on ? "on" : "off");
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 기억 못 해도 동작에는 지장 없다.
  }
}

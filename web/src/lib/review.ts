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

/**
 * 채점 후 이 카드가 세션에 다시 들어가는지, 들어간다면 몇 번째 단계인지.
 *
 * 서버 `api/app/vocab/srs.py`의 단계 진행과 같은 규칙이다. 다만 여기서 정하는
 * 것은 **이 세션의 등장 순서뿐**이고, 실제 다음 복습 시각은 서버가 계산한다.
 */
export function nextSessionStep(
  currentStep: number,
  grade: "again" | "good",
  steps: number[],
): number | null {
  if (steps.length === 0) return null;
  const next = grade === "again" ? 0 : currentStep + 1;
  return next < steps.length ? next : null;
}

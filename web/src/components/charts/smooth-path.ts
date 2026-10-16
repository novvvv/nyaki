// 차트 곡선. 단어장별 암기율의 분포 곡선과 날짜별 막대 차트의 곡선 보기가 같이 쓴다.

/**
 * 점들을 부드럽게 잇는 경로. 단조 3차 보간(Fritsch–Carlson)이다.
 *
 * 그냥 베지어로 이으면 값이 0인 칸 근처에서 선이 0 아래로 내려가 "음수 카드"가
 * 있는 것처럼 보인다. 단조 보간은 이웃 점 사이를 넘어가지 않는다.
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const n = points.length;
  const dx = points.slice(1).map((p, i) => p.x - points[i]!.x);
  const slope = points.slice(1).map((p, i) => (p.y - points[i]!.y) / dx[i]!);
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    const a = slope[i - 1]!;
    const b = slope[i]!;
    return a * b <= 0
      ? 0
      : (3 * (dx[i - 1]! + dx[i]!)) /
          ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b);
  });

  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${p.x + h},${p.y + h * tangent[i]!} ${q.x - h},${q.y - h * tangent[i + 1]!} ${q.x},${q.y}`;
  }
  return d;
}

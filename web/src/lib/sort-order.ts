/**
 * 단어장 순서 계산.
 *
 * 순서 값은 실수다. 3번과 4번 사이로 옮기면 3.5를 주면 되므로 **옮긴 행 하나만**
 * 저장하면 된다. 정수라면 아래 행들의 번호를 전부 다시 써야 하고, 그 변경이
 * 오프라인 동기화에 한꺼번에 밀려 올라간다.
 */

/** 같은 자리에 계속 끼워 넣으면 간격이 줄어든다. 이보다 좁아지면 다시 매긴다. */
const MIN_GAP = 1e-6;

export interface Ordered {
  id: string;
  sortOrder?: number;
}

/**
 * [from]번째를 [to]번째 자리로 옮겼을 때 저장할 값들.
 *
 * 보통 한 건만 돌려준다. 자리 간격이 바닥나면(실수 정밀도) 전체를 1, 2, 3…으로
 * 다시 매긴 목록을 돌려준다 — 40~50번쯤 같은 자리에 끼워 넣어야 걸린다.
 */
export function reorder<T extends Ordered>(
  items: T[],
  from: number,
  to: number,
): { items: T[]; changed: { id: string; sortOrder: number }[] } {
  if (from === to || from < 0 || to < 0 || from >= items.length) {
    return { items, changed: [] };
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  const before = to > 0 ? orderOf(next[to - 1]!, to - 1) : undefined;
  const after = to < next.length - 1 ? orderOf(next[to + 1]!, to + 1) : undefined;

  const value = between(before, after);
  if (value === null) {
    // 자리가 없다 — 전부 다시 매긴다.
    const changed = next.map((item, index) => ({ id: item.id, sortOrder: index + 1 }));
    return {
      items: next.map((item, index) => ({ ...item, sortOrder: index + 1 })),
      changed,
    };
  }

  return {
    items: next.map((item) =>
      item.id === moved!.id ? { ...item, sortOrder: value } : item,
    ),
    changed: [{ id: moved!.id, sortOrder: value }],
  };
}

/** 값이 없는 행(구버전에서 만든 것)은 목록에서의 자리를 값으로 본다. */
function orderOf(item: Ordered, index: number): number {
  return item.sortOrder ?? index + 1;
}

/** 두 자리 사이의 값. 끼울 틈이 없으면 null. */
function between(before?: number, after?: number): number | null {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  if (after - before < MIN_GAP) return null;
  return (before + after) / 2;
}

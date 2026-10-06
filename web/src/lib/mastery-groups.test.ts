import { beforeEach, describe, expect, it } from "vitest";

import {
  computeGroupRow,
  isGroupId,
  loadGroups,
  newGroupId,
  saveGroups,
  type MasteryGroup,
} from "./mastery-groups";
import type { MasteryRow } from "./stats";

/**
 * 그룹 — 여러 단어장을 하나의 암기율로 본다.
 *
 * 암기율을 평균 내면 작은 단어장이 큰 단어장만큼 무게를 갖는다. 카드 수로 다시
 * 세야 "이 묶음 전체에서 몇 %를 외웠나"가 된다.
 */

// stages: 새 카드 · 학습 중 · 1일 · 3일 · 1주 · 1달+ (앞 둘이 X)
function row(
  id: string,
  stages: number[],
  rate: number,
  itemCount: number,
): MasteryRow {
  return { id, title: id, rate, itemCount, stages };
}

function group(bookIds: string[], name = "묶음"): MasteryGroup {
  return { id: "group:g1", name, bookIds };
}

describe("computeGroupRow — 카드 수로 합친다", () => {
  it("평균이 아니라 OK 카드 ÷ 전체 카드다", () => {
    // A: 100장 중 OK 50장(50%), B: 10장 중 OK 10장(100%)
    const rows = [
      row("a", [30, 20, 25, 15, 5, 5], 50, 100),
      row("b", [0, 0, 2, 3, 3, 2], 100, 10),
    ];

    const merged = computeGroupRow(group(["a", "b"]), rows);

    // 평균이면 75%, 카드 수로 세면 60 ÷ 110 = 54.5 → 55%
    expect(merged.rate).toBe(55);
    expect(merged.itemCount).toBe(110);
    expect(merged.stages).toEqual([30, 20, 27, 18, 8, 7]);
    expect(merged.memberCount).toBe(2);
  });

  it("지워진 단어장은 빠지고 남은 것만 센다", () => {
    const rows = [row("a", [0, 0, 1, 1, 0, 0], 100, 2)];

    const merged = computeGroupRow(group(["a", "gone"]), rows);

    expect(merged.rate).toBe(100);
    expect(merged.memberCount).toBe(1);
  });

  it("같은 단어장을 두 번 넣어도 한 번만 센다", () => {
    const rows = [
      row("a", [1, 0, 1, 0, 0, 0], 50, 2),
      row("b", [0, 0, 0, 0, 0, 2], 100, 2),
    ];

    const merged = computeGroupRow(group(["a", "a", "b"]), rows);

    expect(merged.itemCount).toBe(4);
    expect(merged.rate).toBe(75);
  });

  it("남은 단어장이 없으면 비어 있는 그룹이다", () => {
    const merged = computeGroupRow(group(["gone"]), []);

    expect(merged.memberCount).toBe(0);
    expect(merged.itemCount).toBe(0);
    expect(merged.rate).toBe(0);
  });

  it("단계를 모르는 단어장이 섞이면 단어 수로 가중한 근사치, 곡선은 없다", () => {
    const rows = [row("a", [], 50, 100), row("b", [0, 0, 1, 0, 0, 0], 100, 10)];

    const merged = computeGroupRow(group(["a", "b"]), rows);

    // (50×100 + 100×10) ÷ 110 = 54.5 → 55
    expect(merged.rate).toBe(55);
    expect(merged.stages).toEqual([]);
  });
});

describe("그룹 저장", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("저장한 그대로 불러온다", () => {
    const groups = [group(["a", "b"], "일본어 전체")];
    saveGroups(groups);

    expect(loadGroups()).toEqual(groups);
  });

  it("깨진 저장값은 버린다", () => {
    window.localStorage.setItem("nyaki.stats.masteryGroups", "{not json");
    expect(loadGroups()).toEqual([]);

    window.localStorage.setItem(
      "nyaki.stats.masteryGroups",
      JSON.stringify([{ id: "no-prefix", name: "x", bookIds: [] }, { id: 1 }]),
    );
    expect(loadGroups()).toEqual([]);
  });

  it("그룹 id는 단어장 id와 섞여도 구분된다", () => {
    const id = newGroupId();

    expect(isGroupId(id)).toBe(true);
    expect(isGroupId("book-123")).toBe(false);
  });
});

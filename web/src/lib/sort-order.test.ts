import { describe, expect, it } from "vitest";

import { reorder } from "./sort-order";

const books = (...orders: number[]) =>
  orders.map((sortOrder, index) => ({ id: `b${index + 1}`, sortOrder }));

describe("reorder — 끌어서 옮긴 자리 계산", () => {
  it("옮긴 것 하나만 저장한다 — 아래 행 번호를 다시 쓰지 않는다", () => {
    const { items, changed } = reorder(books(1, 2, 3), 0, 1); // b1을 b2 뒤로

    expect(items.map((b) => b.id)).toEqual(["b2", "b1", "b3"]);
    expect(changed).toEqual([{ id: "b1", sortOrder: 2.5 }]);
  });

  it("맨 위로 옮기면 첫 값보다 작은 값을 준다", () => {
    const { changed } = reorder(books(1, 2, 3), 2, 0);
    expect(changed).toEqual([{ id: "b3", sortOrder: 0 }]);
  });

  it("맨 아래로 옮기면 마지막 값보다 큰 값을 준다", () => {
    const { changed } = reorder(books(1, 2, 3), 0, 2);
    expect(changed).toEqual([{ id: "b1", sortOrder: 4 }]);
  });

  it("제자리면 아무것도 저장하지 않는다", () => {
    expect(reorder(books(1, 2, 3), 1, 1).changed).toEqual([]);
  });

  it("끼울 틈이 없으면 전부 1, 2, 3…으로 다시 매긴다", () => {
    // 같은 자리에 40~50번쯤 끼워 넣어야 실제로 걸리는 상황이다.
    const tight = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 2 + 1e-12 },
    ];

    const { items, changed } = reorder(tight, 0, 1); // a를 b와 c 사이로

    expect(items.map((b) => b.id)).toEqual(["b", "a", "c"]);
    expect(changed).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ]);
  });

  it("순서 값이 없는 행은 목록에서의 자리로 본다 — 구버전에서 만든 것", () => {
    const mixed = [{ id: "a" }, { id: "b" }, { id: "c" }];

    const { changed } = reorder(mixed, 2, 0);

    // 옮긴 뒤 c 아래에 놓인 a의 자리를 2로 보고, 그보다 하나 작은 값을 준다.
    // a·b는 값이 없어 서버에서 맨 뒤로 가므로 c → a → b 순서가 유지된다.
    expect(changed).toEqual([{ id: "c", sortOrder: 1 }]);
  });
});

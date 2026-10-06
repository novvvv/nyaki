import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MasteryRow } from "@/lib/stats";

import { MasteryByBook } from "./mastery-by-book";

/**
 * 단어장별 암기율 — 고른 단어장만 보인다.
 *
 * 단어장이 많으면 폰에서 막대가 줄줄이 늘어서 읽을 수 없었다. 고른 적이 없으면
 * 단어 많은 3개만 보이고, "단어장 고르기"로 직접 고르면 이 브라우저에 남는다.
 */

const STORAGE_KEY = "nyaki.stats.masteryBooks";

// 들어오는 순서는 암기율 높은 순이다(computeMasteryByBook).
// stages: 새 카드 · 학습 중 · 1일 · 3일 · 1주 · 1달+
const DATA: MasteryRow[] = [
  { id: "a", title: "가", rate: 90, itemCount: 5, stages: [0, 0, 1, 1, 1, 2] },
  {
    id: "b",
    title: "나",
    rate: 70,
    itemCount: 50,
    stages: [5, 10, 10, 10, 10, 5],
  },
  {
    id: "c",
    title: "다",
    rate: 40,
    itemCount: 30,
    stages: [10, 8, 6, 3, 2, 1],
  },
  {
    id: "d",
    title: "라",
    rate: 20,
    itemCount: 80,
    stages: [50, 14, 8, 4, 2, 2],
  },
  { id: "e", title: "마", rate: 10, itemCount: 1, stages: [1, 0, 0, 0, 0, 0] },
];

function shownTitles(): string[] {
  const list = screen.getByRole("list", { name: "단어장별 암기율 비교" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("span")!.textContent!);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("MasteryByBook — 보여줄 단어장", () => {
  it("고른 적이 없으면 단어 많은 3개를 암기율 높은 순으로 보인다", () => {
    render(<MasteryByBook data={DATA} />);

    // 단어 많은 순: 라(80) · 나(50) · 다(30). 보이는 순서는 암기율 높은 순.
    expect(shownTitles()).toEqual(["나", "다", "라"]);
  });

  it("고르면 바로 반영되고 이 브라우저에 남는다", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MasteryByBook data={DATA} />);

    await user.click(screen.getByRole("button", { name: "단어장 고르기" }));
    await user.click(screen.getByRole("checkbox", { name: "가" }));
    await user.click(screen.getByRole("checkbox", { name: "라" }));

    expect(shownTitles()).toEqual(["가", "나", "다"]);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual([
      "a",
      "b",
      "c",
    ]);

    // 다시 열어도 고른 그대로다.
    unmount();
    render(<MasteryByBook data={DATA} />);
    expect(shownTitles()).toEqual(["가", "나", "다"]);
  });

  it("고른 단어장이 지워졌으면 그냥 빠진다", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["gone", "e"]));

    render(<MasteryByBook data={DATA} />);

    expect(shownTitles()).toEqual(["마"]);
  });

  it("다 빼면 안내만 보인다", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["e"]));
    render(<MasteryByBook data={DATA} />);

    await user.click(screen.getByRole("button", { name: "단어장 고르기" }));
    await user.click(screen.getByRole("checkbox", { name: "마" }));

    expect(screen.getByText("고른 단어장이 없어요.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });

  it("저장값이 깨져 있으면 기본으로 돌아간다", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    render(<MasteryByBook data={DATA} />);

    expect(shownTitles()).toEqual(["나", "다", "라"]);
  });

  it("고르기 목록은 완료를 누르면 접힌다", async () => {
    const user = userEvent.setup();
    render(<MasteryByBook data={DATA} />);

    await user.click(screen.getByRole("button", { name: "단어장 고르기" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "완료" }));
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

/** jsdom에는 ResizeObserver가 없다. 곡선은 폭을 재서 그리므로 폭을 알려주는 가짜를 끼운다. */
class FakeResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe() {
    this.callback(
      [{ contentRect: { width: 600 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

describe("MasteryByBook — 곡선", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("곡선으로 바꾸면 보이는 단어장마다 선 하나와 범례가 생긴다", async () => {
    const user = userEvent.setup();
    const { container } = render(<MasteryByBook data={DATA} />);

    await user.click(screen.getByRole("button", { name: "곡선" }));

    expect(
      screen.getByRole("img", { name: "단어장별 암기 단계 분포" }),
    ).toBeInTheDocument();
    // 기본 3개(단어 많은 순) — 나 · 다 · 라
    expect(container.querySelectorAll("path")).toHaveLength(3);
    const legend = screen.getByRole("list", { name: "범례" });
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["나", "다", "라"]);
    // 단계 6칸이 x축에 깔린다.
    for (const label of ["새 카드", "학습 중", "1일", "3일", "1주", "1달+"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("곡선은 0 아래로 내려가지 않는다", async () => {
    const user = userEvent.setup();
    const { container } = render(<MasteryByBook data={DATA} />);

    await user.click(screen.getByRole("button", { name: "곡선" }));

    // 바닥선의 y보다 아래(큰 y)로 가는 제어점이 없어야 한다.
    const base = Math.max(
      ...Array.from(container.querySelectorAll("line")).map((l) =>
        Number(l.getAttribute("y1")),
      ),
    );
    for (const path of container.querySelectorAll("path")) {
      const ys = (path.getAttribute("d") ?? "")
        .split(/[ MC]/)
        .filter(Boolean)
        .map((pair) => Number(pair.split(",")[1]));
      expect(Math.max(...ys)).toBeLessThanOrEqual(base + 0.001);
    }
  });

  it("서버가 단계를 아직 안 보내면 안내만 보인다", async () => {
    const user = userEvent.setup();
    render(
      <MasteryByBook data={DATA.map((row) => ({ ...row, stages: [] }))} />,
    );

    await user.click(screen.getByRole("button", { name: "곡선" }));

    expect(
      screen.getByText("단계 정보를 아직 불러오지 못했어요."),
    ).toBeInTheDocument();
  });

  it("막대로 돌아오면 막대 목록이 다시 보인다", async () => {
    const user = userEvent.setup();
    render(<MasteryByBook data={DATA} />);

    await user.click(screen.getByRole("button", { name: "곡선" }));
    await user.click(screen.getByRole("button", { name: "막대" }));

    expect(shownTitles()).toEqual(["나", "다", "라"]);
  });
});

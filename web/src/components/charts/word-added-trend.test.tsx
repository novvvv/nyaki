import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WordAddedTrend } from "./word-added-trend";

/**
 * jsdom에는 ResizeObserver가 없다. 차트는 컨테이너 너비를 재서 그리므로
 * 관찰을 시작하는 순간 폭을 알려주는 가짜를 끼운다(브라우저도 observe() 직후
 * 한 번 호출한다).
 */
const WIDTH = 600;

class FakeResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe() {
    this.callback(
      [{ contentRect: { width: WIDTH } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

const DATA = [
  { date: "2026-09-20", count: 0 },
  { date: "2026-09-21", count: 3 },
  { date: "2026-09-22", count: 0 },
  { date: "2026-09-23", count: 7 },
];

function bars(container: HTMLElement) {
  return container.querySelectorAll('rect[fill="var(--nyaki-ink)"]');
}

function bands(container: HTMLElement) {
  return container.querySelectorAll('rect[fill="transparent"]');
}

describe("WordAddedTrend — 일별 추가 막대", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("값이 있는 날만 막대를 그린다", () => {
    const { container } = render(<WordAddedTrend data={DATA} />);
    expect(bars(container)).toHaveLength(2);
  });

  it("칸마다 히트 영역이 하나씩 있다 — 0인 날도 가리킬 수 있다", () => {
    const { container } = render(<WordAddedTrend data={DATA} />);
    expect(bands(container)).toHaveLength(DATA.length);
  });

  it("가리킨 칸의 날짜와 개수를 보여준다", () => {
    // 이 차트의 버그가 여기였다. 포인터 좌표를 요소 너비로 환산하다가
    // SVG 여백만큼 어긋나서 커서보다 왼쪽 날짜가 잡혔다.
    const { container } = render(<WordAddedTrend data={DATA} />);

    fireEvent.pointerMove(bands(container)[3]!);
    expect(screen.getByText("2026-09-23")).toBeInTheDocument();
    expect(screen.getByText("7개")).toBeInTheDocument();

    fireEvent.pointerMove(bands(container)[0]!);
    expect(screen.getByText("2026-09-20")).toBeInTheDocument();
    expect(screen.getByText("0개")).toBeInTheDocument();
  });

  it("포인터가 나가면 툴팁을 치운다", () => {
    const { container } = render(<WordAddedTrend data={DATA} />);

    fireEvent.pointerMove(bands(container)[1]!);
    expect(screen.getByText("2026-09-21")).toBeInTheDocument();

    fireEvent.pointerLeave(container.querySelector("svg")!);
    expect(screen.queryByText("2026-09-21")).not.toBeInTheDocument();
  });

  it("데이터가 없으면 그리지 않는다", () => {
    render(<WordAddedTrend data={[]} />);
    expect(screen.getByText("표시할 데이터가 없어요.")).toBeInTheDocument();
  });

  it("표로 보기로 바꾸면 날짜와 개수를 최신순으로 늘어놓는다", () => {
    render(<WordAddedTrend data={DATA} />);

    fireEvent.click(screen.getByRole("button", { name: "표로 보기" }));

    const rows = screen.getAllByRole("row").slice(1); // 머리글 제외
    expect(rows).toHaveLength(DATA.length);
    expect(rows[0]).toHaveTextContent("2026-09-23");
    expect(rows[0]).toHaveTextContent("7");
  });

  it("shapeToggle이면 표로 보기 대신 막대 · 곡선을 고른다", () => {
    const { container } = render(<WordAddedTrend data={DATA} shapeToggle />);

    expect(screen.queryByRole("button", { name: "표로 보기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "곡선" }));

    // 막대는 사라지고 선 하나(+ 아래 채움)가 생긴다. 히트 영역은 그대로다.
    expect(bars(container)).toHaveLength(0);
    expect(container.querySelector('path[fill="none"]')).not.toBeNull();
    expect(bands(container)).toHaveLength(DATA.length);

    fireEvent.click(screen.getByRole("button", { name: "막대" }));
    expect(bars(container)).toHaveLength(2);
  });

  it("곡선은 0 아래(바닥선 밑)로 내려가지 않는다", () => {
    const { container } = render(<WordAddedTrend data={DATA} shapeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "곡선" }));

    const d = container.querySelector('path[fill="none"]')!.getAttribute("d")!;
    const ys = d
      .split(/[ MC]/)
      .filter(Boolean)
      .map((pair) => Number(pair.split(",")[1]));
    // 바닥선 y = HEIGHT(200) - PAD_BOTTOM(26)
    expect(Math.max(...ys)).toBeLessThanOrEqual(174);
  });

  it("툴팁 단위를 바꿀 수 있다 — 넘긴 횟수는 번", () => {
    const { container } = render(<WordAddedTrend data={DATA} unit="번" />);

    fireEvent.pointerMove(bands(container)[3]!);
    expect(screen.getByText("7번")).toBeInTheDocument();
  });
});

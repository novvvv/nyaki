import { describe, expect, it, vi } from "vitest";

import { formatDelay, nextSessionStep, shuffled } from "./review";

describe("formatDelay — 채점 버튼에 띄울 간격", () => {
  it("30초 이하는 '즉시'로 본다 (단계를 끈 경우의 모름)", () => {
    expect(formatDelay(0)).toBe("즉시");
    expect(formatDelay(30)).toBe("즉시");
  });

  it("한 시간 미만은 분", () => {
    expect(formatDelay(60)).toBe("1분");
    expect(formatDelay(600)).toBe("10분");
    expect(formatDelay(3540)).toBe("59분");
  });

  it("하루 미만은 시간", () => {
    expect(formatDelay(3600)).toBe("1시간");
    expect(formatDelay(7200)).toBe("2시간");
  });

  it("하루 이상은 일 — SM-2 간격이 여기에 해당한다", () => {
    expect(formatDelay(86400)).toBe("1일");
    expect(formatDelay(86400 * 3)).toBe("3일");
    expect(formatDelay(86400 * 20)).toBe("20일");
  });
});

describe("shuffled — 랜덤 섞기", () => {
  it("원본을 건드리지 않는다", () => {
    const source = [1, 2, 3, 4, 5];
    shuffled(source);
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });

  it("같은 원소를 모두 보존한다 — 빠지거나 늘지 않는다", () => {
    const source = ["a", "b", "c", "d"];
    expect([...shuffled(source)].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("빈 배열과 한 개짜리도 안전하다", () => {
    expect(shuffled([])).toEqual([]);
    expect(shuffled([7])).toEqual([7]);
  });

  it("실제로 순서를 바꾼다", () => {
    // Math.random을 고정해 결정적으로 검증한다.
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(shuffled([1, 2, 3])).not.toEqual([1, 2, 3]);
    spy.mockRestore();
  });
});

describe("nextSessionStep — 세션 안 재출제", () => {
  const steps = [1, 10];

  it("모름은 첫 단계로 돌아간다", () => {
    expect(nextSessionStep(1, "again", steps)).toBe(0);
  });

  it("외움은 다음 단계로", () => {
    expect(nextSessionStep(0, "good", steps)).toBe(1);
  });

  it("마지막 단계에서 외우면 졸업 — 세션에서 빠진다", () => {
    expect(nextSessionStep(1, "good", steps)).toBeNull();
  });

  it("단계를 안 쓰면 재출제가 없다", () => {
    expect(nextSessionStep(0, "again", [])).toBeNull();
    expect(nextSessionStep(0, "good", [])).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, PrimaryButton, SubtleButton } from "./ui";

/**
 * 공용 버튼의 계약만 본다 — 눌리는지, 잠기는지, 라벨이 읽히는지.
 * 레이아웃은 눈으로 바로 보이지만 disabled가 풀리는 버그는 안 보인다.
 */
describe("PrimaryButton", () => {
  it("라벨을 읽을 수 있고 클릭이 전달된다", async () => {
    const onClick = vi.fn();
    render(<PrimaryButton onClick={onClick}>시작하기</PrimaryButton>);

    const button = screen.getByRole("button", { name: "시작하기" });
    button.click();

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disabled면 클릭이 전달되지 않는다", () => {
    const onClick = vi.fn();
    render(
      <PrimaryButton disabled onClick={onClick}>
        시작하기
      </PrimaryButton>,
    );

    screen.getByRole("button", { name: "시작하기" }).click();

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("SubtleButton", () => {
  it("aria-pressed로 토글 상태를 전달한다 — 색만으로는 스크린리더가 못 읽는다", () => {
    render(
      <SubtleButton aria-pressed={true}>랜덤 섞기 ON</SubtleButton>,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("EmptyState", () => {
  it("제목과 설명을 보여준다", () => {
    render(<EmptyState title="단어가 없습니다" description="첫 단어를 추가해 보세요." />);

    expect(screen.getByText("단어가 없습니다")).toBeInTheDocument();
    expect(screen.getByText("첫 단어를 추가해 보세요.")).toBeInTheDocument();
  });
});

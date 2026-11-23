import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Features } from "@/lib/api-client";

/**
 * 단어 입력 화면의 사진 칸 — 유료 기능.
 *
 * 잠긴 계정은 안내만 보고 고를 수 없다. 기능을 아직 모르는 동안에는 아무것도
 * 안 보여서 잠금 안내가 번쩍이지 않는다. 열린 계정이 허용 안 된 파일을 고르면
 * 올리기 전에 막는다.
 */

let features: Features | null = null;
vi.mock("@/lib/features", () => ({ useFeatures: () => features }));

import { WordPhotoField } from "./word-photo-field";

describe("WordPhotoField", () => {
  beforeEach(() => {
    features = null;
  });

  it("기능을 모르는 동안에는 아무것도 안 보인다", () => {
    const { container } = render(
      <WordPhotoField change={null} onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("잠긴 계정은 프리미엄 안내만 보고 고를 수 없다", () => {
    features = { cardPhotos: false };
    render(<WordPhotoField change={null} onChange={() => {}} />);
    expect(screen.getByText("프리미엄")).toBeInTheDocument();
    expect(screen.getByText("카드에 사진 넣기")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "준비 중" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "사진 넣기" })).toBeNull();
  });

  it("열린 계정은 사진 넣기 버튼을 본다", () => {
    features = { cardPhotos: true };
    render(<WordPhotoField change={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "사진 넣기" })).toBeEnabled();
    expect(screen.queryByText("프리미엄")).toBeNull();
  });

  it("붙은 사진이 있으면 바꾸기 · 빼기를 본다", () => {
    features = { cardPhotos: true };
    render(
      <WordPhotoField
        savedUrl="https://r2.test/get/a.webp"
        change={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "사진 바꾸기" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "사진 빼기" })).toBeEnabled();
  });

  it("뺀다고 하면 저장할 때 뺄 것으로 표시한다", async () => {
    features = { cardPhotos: true };
    const onChange = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <WordPhotoField
        savedUrl="https://r2.test/get/a.webp"
        change={null}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "사진 빼기" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "remove" });
  });

  it("허용 안 된 파일은 올리기 전에 막는다", async () => {
    features = { cardPhotos: true };
    const onChange = vi.fn();
    const { container } = render(
      <WordPhotoField change={null} onChange={onChange} />,
    );
    const input = container.querySelector(
      "input[type=file]",
    ) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(["gif"], "cat.gif", { type: "image/gif" }),
      { applyAccept: false },
    );
    expect(
      await screen.findByText("JPG, PNG, WebP 사진만 넣을 수 있어요."),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

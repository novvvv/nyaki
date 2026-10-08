import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Progress } from "@/lib/api-client";

/**
 * 마이페이지 출석 버튼.
 *
 * "오늘"은 서버가 정한다. 화면은 서버 응답대로 버튼 상태와 츄르 숫자를 바꾸기만
 * 한다. 연타해도 요청은 한 번이어야 한다 — 서버가 막긴 하지만, 화면이 같은 요청을
 * 여러 번 쏘면 "출석하는 중…"이 깜빡이며 헷갈린다.
 */

const fetchProgress = vi.fn();
const checkIn = vi.fn();

vi.mock("@/lib/api-client", () => ({
  fetchProgress: (...args: unknown[]) => fetchProgress(...args),
  checkIn: (...args: unknown[]) => checkIn(...args),
  updateSettings: vi.fn(),
}));

// 실제 getToken은 useCallback이라 렌더마다 같은 함수다. 여기서도 같게 둬야
// 진행도를 다시 받는 effect가 렌더마다 돌며 출석 결과를 덮어쓰지 않는다.
const auth = {
  user: { displayName: "냐키", email: "nyaki@example.com" },
  getToken: async () => "t",
  signOutUser: vi.fn(),
};

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => auth,
}));

vi.mock("@/lib/vocab-store", () => ({
  useVocab: () => ({ wordBooks: [] }),
  bookMeta: () => ({ count: 0 }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import MyPage from "./page";

const NEXT_RESET = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

function progress(overrides: Partial<Progress> = {}): Progress {
  return {
    churuBalance: 10,
    capelinBalance: 2,
    completedToday: [],
    dailyNewLimit: 9999,
    dailyReviewLimit: 9999,
    learningSteps: [0, 10],
    relearningSteps: [0],
    graduatingIntervalDays: 1,
    attendance: { checkedInToday: false, streak: 2, nextResetAt: NEXT_RESET },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchProgress.mockResolvedValue(progress());
});

describe("마이페이지 — 출석", () => {
  it("출석 전에는 출석하기, 누르면 츄르가 오르고 완료로 바뀐다", async () => {
    const user = userEvent.setup();
    checkIn.mockResolvedValue({
      granted: 5,
      date: "2026-10-08",
      churuBalance: 15,
      attendance: { checkedInToday: true, streak: 3, nextResetAt: NEXT_RESET },
    });
    render(<MyPage />);

    const button = await screen.findByRole("button", { name: "출석하기" });
    expect(screen.getByText("10")).toBeInTheDocument();

    await user.click(button);

    expect(
      await screen.findByRole("button", { name: "출석 완료 · 3일 연속" }),
    ).toBeDisabled();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText(/다음 출석까지 \d+시간/)).toBeInTheDocument();
  });

  it("이미 출석했으면 처음부터 완료로 보이고 누를 수 없다", async () => {
    fetchProgress.mockResolvedValue(
      progress({
        attendance: {
          checkedInToday: true,
          streak: 5,
          nextResetAt: NEXT_RESET,
        },
      }),
    );
    render(<MyPage />);

    expect(
      await screen.findByRole("button", { name: "출석 완료 · 5일 연속" }),
    ).toBeDisabled();
    expect(checkIn).not.toHaveBeenCalled();
  });

  it("연타해도 요청은 한 번이다", async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => {};
    checkIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<MyPage />);
    const button = await screen.findByRole("button", { name: "출석하기" });

    await user.click(button);
    await user.click(screen.getByRole("button", { name: "출석하는 중…" }));
    await user.click(screen.getByRole("button", { name: "출석하는 중…" }));
    finish({
      granted: 5,
      date: "2026-10-08",
      churuBalance: 15,
      attendance: { checkedInToday: true, streak: 3, nextResetAt: NEXT_RESET },
    });

    await screen.findByRole("button", { name: "출석 완료 · 3일 연속" });
    expect(checkIn).toHaveBeenCalledTimes(1);
  });

  it("실패하면 메시지를 보이고 다시 누를 수 있다", async () => {
    const user = userEvent.setup();
    checkIn.mockRejectedValue(new Error("서버 요청에 실패했습니다."));
    render(<MyPage />);

    await user.click(await screen.findByRole("button", { name: "출석하기" }));

    expect(
      await screen.findByText("서버 요청에 실패했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "출석하기" })).toBeEnabled();
  });

  it("서버가 아직 출석을 모르면(배포 전) 버튼을 띄우지 않는다", async () => {
    fetchProgress.mockResolvedValue(progress({ attendance: undefined }));
    render(<MyPage />);

    await waitFor(() => expect(fetchProgress).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /출석/ })).toBeNull();
  });
});

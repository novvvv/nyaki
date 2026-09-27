import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 로그인 화면.
 *
 * 로그인 방법은 구글 하나다. 여기서 지키는 것은 세 가지다 —
 * 이미 로그인한 사람을 붙잡아두지 않고, 실패를 사람이 읽을 문구로 바꾸고,
 * 돌아갈 주소(`?next=`)를 잃지 않는 것.
 */

const signIn = vi.fn();
const replace = vi.fn();
let auth = {
  ready: true,
  user: null as unknown,
  configured: true,
  signIn: (...args: unknown[]) => signIn(...args),
};
let search = new URLSearchParams();

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => auth,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}));

import LoginPage from "./page";

beforeEach(() => {
  signIn.mockReset().mockResolvedValue(undefined);
  replace.mockReset();
  search = new URLSearchParams();
  auth = {
    ready: true,
    user: null,
    configured: true,
    signIn: (...args: unknown[]) => signIn(...args),
  };
});

describe("로그인 화면", () => {
  it("구글 버튼을 누르면 로그인을 시작한다", async () => {
    render(<LoginPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /Google로 계속하기/ }),
    );

    expect(signIn).toHaveBeenCalledOnce();
  });

  it("이미 로그인했으면 보던 자리로 돌려보낸다", async () => {
    auth = { ...auth, user: { uid: "u1" } };
    search = new URLSearchParams("next=/word-books/b1");

    render(<LoginPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/word-books/b1"));
  });

  it("바깥 주소는 따라가지 않는다 — 열린 리디렉션 방지", async () => {
    auth = { ...auth, user: { uid: "u1" } };
    search = new URLSearchParams("next=https://evil.example");

    render(<LoginPage />);

    // 막으면 기본 경로로 보낸다(safeNext).
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/word-books"));
  });

  it("팝업이 막히면 무엇을 해야 하는지 알려준다", async () => {
    signIn.mockRejectedValue(new FirebaseError("auth/popup-blocked", "blocked"));

    render(<LoginPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /Google로 계속하기/ }),
    );

    expect(await screen.findByText(/팝업을 허용하고/)).toBeInTheDocument();
  });

  it("모르는 오류도 원문 대신 사람이 읽을 문구로 바꾼다", async () => {
    // Firebase 원문은 "Firebase: Error (auth/internal-error)." 같은 모양이다.
    signIn.mockRejectedValue(new FirebaseError("auth/internal-error", "boom"));

    render(<LoginPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /Google로 계속하기/ }),
    );

    expect(await screen.findByText(/다시 한 번 눌러 달라냥/)).toBeInTheDocument();
  });

  it("환경 변수가 없으면 버튼 대신 이유를 보여준다", () => {
    auth = { ...auth, configured: false };

    render(<LoginPage />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/NEXT_PUBLIC_FIREBASE_/)).toBeInTheDocument();
  });
});

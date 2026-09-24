"use client";

import { FirebaseError } from "firebase/app";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { PrimaryButton, TextInput } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";
import { cn } from "@/lib/utils";

// 헤더·푸터를 뺀 높이만큼만 써서 화면 한가운데에 둔다.
const SCREEN =
  "flex min-h-[calc(100vh-8.5rem)] flex-col items-center justify-center px-6 py-16";

type Mode = "signIn" | "signUp";

/* Firebase 오류 코드를 사람이 읽을 문구로. 서비스 톤에 맞춘다. */
function messageFor(error: unknown, mode: Mode): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "이메일이나 비밀번호가 맞지 않다냥";
      case "auth/email-already-in-use":
        return "이미 가입된 이메일이다냥. 로그인으로 들어와 달라냥";
      case "auth/weak-password":
        return "비밀번호는 여섯 자 이상이어야 한다냥";
      case "auth/invalid-email":
        return "이메일 형식이 아니다냥";
      case "auth/too-many-requests":
        return "잠시 뒤에 다시 시도해 달라냥";
      // Firebase 콘솔에서 이메일 로그인을 켜지 않았을 때 온다.
      case "auth/operation-not-allowed":
        return "이메일 로그인이 아직 열려 있지 않다냥";
      case "auth/popup-blocked":
        return "브라우저가 로그인 창을 막았다냥. 팝업을 허용하고 다시 눌러 달라냥";
      case "auth/network-request-failed":
        return "인터넷 연결이 불안한 것 같다냥. 잠시 뒤에 다시 눌러 달라냥";
      case "auth/unauthorized-domain":
        return "이 주소에서는 아직 로그인할 수 없다냥";
      default:
        return mode === "signUp"
          ? "가입이 잘 안 됐다냥. 다시 한 번 눌러 달라냥"
          : "로그인이 잘 안 됐다냥. 다시 한 번 눌러 달라냥";
    }
  }
  return error instanceof Error
    ? error.message
    : "로그인이 잘 안 됐다냥. 다시 한 번 눌러 달라냥";
}

function LoginScreen() {
  const { ready, user, configured, signIn, signInWithEmail, signUpWithEmail } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // 이미 로그인한 채로 들어오면 붙잡아두지 않는다.
  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(undefined);
    try {
      if (mode === "signUp") await signUpWithEmail(email, password);
      else await signInWithEmail(email, password);
      // 성공해도 onAuthStateChanged가 돌기 전이다. 이동은 위 useEffect가 맡는다.
    } catch (reason) {
      setError(messageFor(reason, mode));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await signIn();
    } catch (reason) {
      setError(messageFor(reason, mode));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className={SCREEN}>
        <p className="text-sm text-ink/40">
          NEXT_PUBLIC_FIREBASE_* 환경 변수를 설정해 주세요.
        </p>
      </main>
    );
  }

  return (
    <main className={SCREEN}>
      <div className="w-full max-w-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cat.png"
          alt="Nyaki 고양이"
          width={500}
          height={500}
          className="mx-auto block h-auto w-[min(160px,42vw)]"
        />

        <div className="mt-10 flex items-center gap-4 text-sm">
          {(
            [
              ["signIn", "로그인"],
              ["signUp", "회원가입"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setError(undefined);
              }}
              className={cn(
                "border-b pb-1 transition",
                mode === value
                  ? "border-ink font-medium text-ink"
                  : "border-transparent text-ink/30 hover:text-ink/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          className="mt-5 flex flex-col gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextInput
            type="email"
            autoComplete="email"
            placeholder="이메일"
            aria-label="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextInput
            type="password"
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            placeholder={mode === "signUp" ? "비밀번호 (여섯 자 이상)" : "비밀번호"}
            aria-label="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PrimaryButton type="submit" disabled={!canSubmit} className="mt-1.5">
            {busy ? "기다려 달라냥…" : mode === "signUp" ? "가입하기" : "로그인"}
          </PrimaryButton>
        </form>

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGoogle()}
          className="mt-8 w-full text-sm text-ink/40 transition hover:text-ink/70 disabled:opacity-45"
        >
          Google로 계속하기
        </button>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams는 정적 프리렌더 중에 값을 알 수 없어 Suspense가 필요하다.
  return (
    <Suspense fallback={<main className={SCREEN} />}>
      <LoginScreen />
    </Suspense>
  );
}

/**
 * 로그인 후 돌아갈 곳.
 *
 * 우리 사이트 안의 경로만 허용한다. `https://...`나 `//evil.com`을 그대로 쓰면
 * "우리 도메인에서 로그인시킨 뒤 남의 사이트로 보내는 주소"를 누구나 만들 수 있다
 * (열린 리디렉션). `//`로 시작하는 값은 첫 검사를 통과하지만 브라우저가
 * "현재 프로토콜 + 저 도메인"으로 읽으므로 따로 막는다.
 */
export const DEFAULT_NEXT = "/word-books";

export function safeNext(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  return raw;
}

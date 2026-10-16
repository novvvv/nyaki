import { cn } from "@/lib/utils";

/**
 * 폴더 · 단어장 이름 왼쪽의 16px 아이콘. 사이드바와 테스트 화면의 단어장 목록이
 * 같이 쓴다. 원본은 32px이라 선명한 화면에서도 깨끗하다.
 *
 * 장식이라 읽어주지 않는다(이름이 이미 있다). 브라우저 기본 이미지 끌기가
 * 줄 끌기(dnd-kit)와 겹치지 않게 막는다.
 *
 * 검은 선 그림이라 다크에서는 뒤집어 밝게 그린다. 칠한 줄(선택됨) 위에서는
 * 바탕이 반대색이라 거꾸로 뒤집는다 — onFilled.
 */
export function ItemIcon({
  src,
  onFilled = false,
}: {
  src: string;
  onFilled?: boolean;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      aria-hidden
      width={16}
      height={16}
      draggable={false}
      className={cn(
        "size-4 shrink-0",
        onFilled ? "invert dark:invert-0" : "dark:invert",
      )}
    />
  );
}

/**
 * 접기 · 펼치기 꺾쇠. 펼치면 아래(⌄), 접으면 오른쪽(›)을 향한다.
 * 예전에는 10px짜리 옅은 ▾ 글자라 어디서 접는지 보이지 않았다.
 */
export function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "size-3.5 shrink-0 transition-transform duration-150",
        !open && "-rotate-90",
        className,
      )}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

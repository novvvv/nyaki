"use client";

import { useAppMode } from "@/lib/app-mode";
import { cn } from "@/lib/utils";

/**
 * 차트 색 — 웹은 흑백(진하기로만 구분), 앱은 분홍 포인트.
 * 앱에서는 막대 · 면을 분홍으로 칠하고, 오늘 · 가리킨 값만 검정으로 짚는다.
 */
export const APP_PINK = "#efd6d6";
/** 막대 · 선처럼 흰 바탕에서 보여야 하는 분홍 — APP_PINK는 너무 옅다. */
export const APP_PINK_DEEP = "#e2a7a7";
export const APP_PINK_SOFT = "#f6e7e7";

/** 앱 곡선의 선 색 — 검정, 분홍, 회색 순. 넷째부터는 점선을 얹는다. */
export const APP_LINE_COLORS = ["var(--nyaki-ink)", APP_PINK_DEEP, "#a3a3a3"];

/**
 * 막대 · 곡선 같은 차트 안 고르기 버튼. 웹은 글자만, 앱은 알약 묶음이다.
 */
export function ChartToggle<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const app = useAppMode();
  return (
    <div
      className={cn(
        "flex items-center",
        app ? "gap-0.5 rounded-full bg-subtle p-0.5" : "gap-3.5",
        className,
      )}
    >
      {options.map(([key, label]) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(key)}
            className={cn(
              "text-xs transition",
              app && "rounded-full px-2.5 py-0.5",
              on
                ? cn("font-semibold text-ink", app && "bg-cream shadow-sm")
                : "font-medium text-umber/45 hover:text-umber/70",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** 위 모서리만 둥근 막대 — 바닥선에 붙은 쪽은 반듯하게. */
export function topRoundedBar(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const r = Math.min(width / 2, height, 6);
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${bottom}`,
    "Z",
  ].join(" ");
}

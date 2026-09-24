"use client";

import type { MasteryRow } from "@/lib/stats";

// 가로 막대인 이유: 암기율은 0~100으로 상한이 정해진 값이고, 비교 대상이
// 시간이 아니라 이름이 긴 단어장들이다. 세로 막대면 이름이 잘리거나 기울어진다.
const WIDTH = 720;
const ROW_HEIGHT = 34;
const BAR_HEIGHT = 9;
const LABEL_WIDTH = 150;
const VALUE_WIDTH = 96;
const AXIS_HEIGHT = 18;

const BAR_LEFT = LABEL_WIDTH;
const BAR_WIDTH = WIDTH - LABEL_WIDTH - VALUE_WIDTH;

/** 라벨 칸을 넘는 제목은 줄인다. 전체 제목은 <title>로 남긴다. */
function shortTitle(title: string): string {
  return title.length > 12 ? `${title.slice(0, 11)}…` : title;
}

export function MasteryByBook({ data }: { data: MasteryRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-sm text-umber/40">
        단어가 있는 단어장이 없어요.
      </div>
    );
  }

  const plotHeight = data.length * ROW_HEIGHT;
  const height = plotHeight + AXIS_HEIGHT;

  return (
    <div>
      <h3 className="text-sm font-medium text-ink">단어장별 암기율</h3>

      <div className="mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label="단어장별 암기율 비교"
        >
          {/* 0 / 50 / 100 기준선 — 상한이 정해진 값이라 눈금이 고정이다 */}
          {[0, 50, 100].map((tick) => {
            const x = BAR_LEFT + (tick / 100) * BAR_WIDTH;
            return (
              <g key={tick}>
                <line
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={plotHeight}
                  stroke="var(--nyaki-taupe)"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-umber/42 text-[10px] tabular-nums"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {data.map((row, i) => {
            const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
            return (
              <g key={row.id}>
                <title>{`${row.title} — ${row.rate}% (${row.itemCount}개)`}</title>

                <text
                  x={LABEL_WIDTH - 12}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-ink/70 text-[12px]"
                >
                  {shortTitle(row.title)}
                </text>

                <rect
                  x={BAR_LEFT}
                  y={y - BAR_HEIGHT / 2}
                  width={BAR_WIDTH}
                  height={BAR_HEIGHT}
                  rx={BAR_HEIGHT / 2}
                  fill="var(--nyaki-taupe)"
                  fillOpacity={0.3}
                />
                <rect
                  x={BAR_LEFT}
                  y={y - BAR_HEIGHT / 2}
                  width={Math.max((row.rate / 100) * BAR_WIDTH, 2)}
                  height={BAR_HEIGHT}
                  rx={BAR_HEIGHT / 2}
                  fill="var(--chart-1)"
                  fillOpacity={0.85}
                />

                <text
                  x={BAR_LEFT + BAR_WIDTH + 12}
                  y={y}
                  dominantBaseline="middle"
                  className="fill-ink text-[12px] font-semibold tabular-nums"
                >
                  {row.rate}%
                </text>
                <text
                  x={WIDTH}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-umber/42 text-[11px] tabular-nums"
                >
                  {row.itemCount}개
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

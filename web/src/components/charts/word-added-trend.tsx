"use client";

import { useMemo, useRef, useState } from "react";

import type { DailyCount } from "@/lib/stats";

const WIDTH = 720;
const HEIGHT = 200;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

/** 축에 쓸 "깔끔한" 상한값으로 올림한다 (0, 1, 2, 5, 10, 20, 50, 100…). */
function niceCeil(value: number): number {
  if (value <= 1) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function WordAddedTrend({ data }: { data: DailyCount[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxValue = useMemo(
    () => niceCeil(Math.max(1, ...data.map((d) => d.count))),
    [data],
  );

  const points = useMemo(() => {
    if (data.length === 0) return [];
    const step = data.length === 1 ? 0 : plotWidth / (data.length - 1);
    return data.map((d, i) => ({
      x: PAD_LEFT + (data.length === 1 ? plotWidth / 2 : i * step),
      y: PAD_TOP + plotHeight - (d.count / maxValue) * plotHeight,
      ...d,
    }));
  }, [data, maxValue, plotWidth, plotHeight]);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1]!.x.toFixed(1)},${
          PAD_TOP + plotHeight
        } L${points[0]!.x.toFixed(1)},${PAD_TOP + plotHeight} Z`
      : "";

  // 라벨은 겹치지 않게 최대 6개만 균등 간격으로.
  const labelIndices = useMemo(() => {
    if (data.length <= 6) return data.map((_, i) => i);
    const count = 6;
    const step = (data.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(i * step));
  }, [data]);

  const gridValues = [0, maxValue / 2, maxValue];

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-umber/40">
        표시할 데이터가 없어요.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">일별 단어 추가</h3>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs text-umber/50 underline decoration-taupe/50 underline-offset-2 transition hover:text-ink"
        >
          {showTable ? "그래프로 보기" : "표로 보기"}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-[220px] overflow-y-auto rounded-lg border border-taupe/25">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-taupe/25 text-umber/50">
                <th className="px-3 py-2 font-medium">날짜</th>
                <th className="px-3 py-2 text-right font-medium">추가한 단어</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-b border-taupe/10 last:border-0">
                  <td className="px-3 py-1.5 text-ink/80">{d.date}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                    {d.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width="100%"
            height={HEIGHT}
            className="overflow-visible"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            role="img"
            aria-label="날짜별 단어 추가 개수 추이"
          >
            {/* 가로 그리드 + y축 라벨 */}
            {gridValues.map((v) => {
              const y = PAD_TOP + plotHeight - (v / maxValue) * plotHeight;
              return (
                <g key={v}>
                  <line
                    x1={PAD_LEFT}
                    x2={WIDTH - PAD_RIGHT}
                    y1={y}
                    y2={y}
                    stroke="var(--nyaki-taupe)"
                    strokeOpacity={0.2}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD_LEFT - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-umber/42 text-[10px] tabular-nums"
                  >
                    {Math.round(v)}
                  </text>
                </g>
              );
            })}

            {/* x축 날짜 라벨 */}
            {labelIndices.map((i) => (
              <text
                key={i}
                x={points[i]!.x}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-umber/42 text-[10px] tabular-nums"
              >
                {formatDateLabel(points[i]!.date)}
              </text>
            ))}

            {/* 영역 채움 */}
            <path d={areaPath} fill="var(--chart-1)" fillOpacity={0.12} stroke="none" />
            {/* 선 — 배경(Ivory)에 자연스럽게 얹히면서도 또렷하게 보이는 절충값 */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--chart-1)"
              strokeOpacity={0.8}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* 크로스헤어 + 포인트 */}
            {hovered ? (
              <g>
                <line
                  x1={hovered.x}
                  x2={hovered.x}
                  y1={PAD_TOP}
                  y2={PAD_TOP + plotHeight}
                  stroke="var(--nyaki-ink)"
                  strokeOpacity={0.12}
                  strokeWidth={1}
                />
                <circle
                  cx={hovered.x}
                  cy={hovered.y}
                  r={3.5}
                  fill="var(--chart-1)"
                  fillOpacity={0.75}
                  stroke="var(--nyaki-cream)"
                  strokeWidth={2}
                />
              </g>
            ) : null}

            {/* 히트 영역 — 전체 플롯 위에 투명 오버레이로 포인터 이벤트 수신 */}
            <rect
              x={PAD_LEFT}
              y={0}
              width={plotWidth}
              height={HEIGHT}
              fill="transparent"
            />
          </svg>

          {hovered ? (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-taupe/30 bg-card px-2.5 py-1.5 text-xs shadow-sm"
              style={{
                left: `${(hovered.x / WIDTH) * 100}%`,
                top: `${(hovered.y / HEIGHT) * 100}%`,
              }}
            >
              <div className="font-semibold tabular-nums text-ink">
                {hovered.count}개
              </div>
              <div className="text-umber/50">{hovered.date}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

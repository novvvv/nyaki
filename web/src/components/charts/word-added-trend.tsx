"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { DailyCount } from "@/lib/stats";

const HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 14;
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

/**
 * 날짜별 추가 개수 — 막대.
 *
 * 선이 아니라 막대인 이유: 하루 추가량은 이어지는 값이 아니라 그날그날의 개수다.
 * 선으로 그으면 값이 없는 날 사이를 비스듬히 이어서, 추가한 적 없는 날에도
 * 뭔가 있었던 것처럼 보이는 삼각형이 줄줄이 생긴다(안키의 Added 그래프도 막대다).
 *
 * **SVG를 컨테이너 픽셀 그대로 그린다.** 전에는 고정 viewBox에 width="100%"를
 * 줬는데, 그러면 넓은 화면에서 내용이 가운데로 몰리고 양옆에 여백이 생긴다.
 * 포인터 좌표를 요소 너비 기준으로 환산하던 계산이 그 여백만큼 어긋나서
 * 커서보다 왼쪽 날짜가 잡혔다. 이제 막대마다 히트 영역을 따로 두므로
 * 좌표 환산 자체가 없다.
 */
export function WordAddedTrend({
  data,
  title = "일별 단어 추가",
  valueLabel = "추가한 단어",
  ariaLabel = "날짜별 단어 추가 개수 추이",
  note,
  highlightLast = false,
}: {
  data: DailyCount[];
  /** 같은 막대 차트를 "복습한 단어"에도 쓴다. 기본값은 단어 추가 차트의 문구다. */
  title?: string;
  /** 표로 볼 때 개수 칸 머리글 */
  valueLabel?: string;
  ariaLabel?: string;
  /** 제목 오른쪽에 붙는 짧은 요약 (예: "오늘 12개") */
  note?: ReactNode;
  /** 마지막 날(오늘) 막대를 진하게, 나머지를 옅게 */
  highlightLast?: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [width, setWidth] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // observe() 직후 한 번 호출되므로 초기값도 여기서 채워진다.
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showTable]);

  const plotWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotHeight;

  const maxValue = useMemo(
    () => niceCeil(Math.max(1, ...data.map((d) => d.count))),
    [data],
  );

  const bars = useMemo(() => {
    if (data.length === 0 || plotWidth <= 0) return [];
    const band = plotWidth / data.length;
    // 칸 사이를 조금 띄우되, 기간이 길어 칸이 좁아지면 띄우기를 포기한다.
    const barWidth = Math.max(1.5, Math.min(band - Math.max(1, band * 0.3), 22));
    return data.map((d, i) => {
      const bandX = PAD_LEFT + i * band;
      const height = (d.count / maxValue) * plotHeight;
      return {
        ...d,
        bandX,
        band,
        center: bandX + band / 2,
        x: bandX + (band - barWidth) / 2,
        width: barWidth,
        y: baseY - height,
        height,
      };
    });
  }, [data, maxValue, plotWidth, plotHeight, baseY]);

  // 라벨은 겹치지 않게 최대 6개만 균등 간격으로.
  const labelIndices = useMemo(() => {
    if (data.length <= 6) return data.map((_, i) => i);
    const step = (data.length - 1) / 5;
    return Array.from({ length: 6 }, (_, i) => Math.round(i * step));
  }, [data]);

  const gridValues = [0, maxValue / 2, maxValue];
  const hovered = hoverIndex !== null ? bars[hoverIndex] : null;

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-umber/40">
        표시할 데이터가 없어요.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          {note ? (
            <span className="text-xs tabular-nums text-umber/50">{note}</span>
          ) : null}
        </div>
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
                <th className="px-3 py-2 text-right font-medium">{valueLabel}</th>
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
        <div ref={boxRef} className="relative mt-3">
          <svg
            viewBox={`0 0 ${Math.max(width, 1)} ${HEIGHT}`}
            width="100%"
            height={HEIGHT}
            onPointerLeave={() => setHoverIndex(null)}
            role="img"
            aria-label={ariaLabel}
          >
            {/* 가로 그리드 + y축 라벨 */}
            {gridValues.map((v) => {
              const y = baseY - (v / maxValue) * plotHeight;
              return (
                <g key={v}>
                  <line
                    x1={PAD_LEFT}
                    x2={width - PAD_RIGHT}
                    y1={y}
                    y2={y}
                    stroke="var(--nyaki-taupe)"
                    strokeOpacity={v === 0 ? 0.45 : 0.18}
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
                x={bars[i]?.center ?? 0}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-umber/42 text-[10px] tabular-nums"
              >
                {formatDateLabel(data[i]!.date)}
              </text>
            ))}

            {/* 막대 — 값이 0인 날은 아무것도 그리지 않는다 */}
            {bars.map((bar, i) =>
              bar.count === 0 ? null : (
                <rect
                  key={bar.date}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={Math.max(bar.height, 1.5)}
                  rx={Math.min(bar.width / 2, 2)}
                  fill="var(--nyaki-ink)"
                  fillOpacity={
                    hoverIndex !== null
                      ? hoverIndex === i
                        ? 0.82
                        : 0.22
                      : highlightLast && i !== bars.length - 1
                        ? 0.4
                        : 0.82
                  }
                  className="transition-[fill-opacity] duration-150"
                />
              ),
            )}

            {/* 히트 영역 — 날짜 칸마다 하나. 좌표를 환산하지 않으니 어긋날 일이 없다. */}
            {bars.map((bar, i) => (
              <rect
                key={`hit-${bar.date}`}
                x={bar.bandX}
                y={PAD_TOP}
                width={bar.band}
                height={plotHeight + PAD_BOTTOM}
                fill="transparent"
                // enter가 아니라 move로 받는다 — enter는 버블링하지 않아서
                // 이벤트 위임을 쓰는 환경(React 합성 이벤트)에서 놓치기 쉽다.
                onPointerMove={() => setHoverIndex(i)}
              />
            ))}
          </svg>

          {hovered ? (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-taupe/30 bg-card px-2.5 py-1.5 text-xs shadow-sm"
              style={{
                // 가장자리 날짜에서 툴팁이 카드 밖으로 잘리지 않게 붙잡는다.
                left: `${Math.min(Math.max(hovered.center, 52), Math.max(width - 52, 52))}px`,
                top: `${Math.max(hovered.y - 8, 0)}px`,
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

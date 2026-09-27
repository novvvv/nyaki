"use client";

import { useRef, useState } from "react";

import { SubtleButton, TextArea } from "@/components/ui";
import {
  countBlanks,
  insertBlank,
  insertBold,
  insertHighlight,
  parseCloze,
  type ClozeToken,
  type Edit,
} from "@/lib/cloze";
import { cn } from "@/lib/utils";

/**
 * 빈칸 노트 편집기. 추가 화면과 수정 화면이 같이 쓴다.
 *
 * `{{c1::답}}`을 손으로 치는 게 불편해서 툴바를 뒀다 — 가릴 부분을 끌어서 고르고
 * 버튼을 누르면 감싼다. 오른쪽 미리보기는 출제 화면과 **같은 파서**를 쓴다.
 */
export function ClozeEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [revealed, setRevealed] = useState(false);

  /** 툴바 버튼의 공통 동작 — 고른 구간에 마크업을 넣고 선택을 되살린다. */
  function apply(edit: (raw: string, start: number, end: number) => Edit) {
    const area = areaRef.current;
    if (!area) return;
    const next = edit(value, area.selectionStart, area.selectionEnd);
    onChange(next.text);
    // 값이 반영된 뒤에 커서를 옮겨야 한다. 지금 옮기면 리렌더가 되돌린다.
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  const blanks = countBlanks(value);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SubtleButton
            className="px-3 py-1.5 text-xs"
            onClick={() => apply(insertBlank)}
          >
            빈칸
          </SubtleButton>
          <SubtleButton
            className="px-3 py-1.5 text-xs font-semibold"
            onClick={() => apply(insertBold)}
          >
            굵게
          </SubtleButton>
          <SubtleButton
            className="px-3 py-1.5 text-xs"
            onClick={() => apply(insertHighlight)}
          >
            <span className="bg-[#FDF3B0] px-1">형광</span>
          </SubtleButton>
        </div>

        <TextArea
          ref={areaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={12}
          aria-label="빈칸 문장"
          className="w-full text-base leading-relaxed"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-umber/45">미리보기</span>
          <SubtleButton
            className="px-3 py-1.5 text-xs"
            aria-pressed={revealed}
            onClick={() => setRevealed((prev) => !prev)}
          >
            {revealed ? "가리기" : "정답 보기"}
          </SubtleButton>
        </div>

        <div className="min-h-[13.5rem] rounded-lg border border-taupe/45 bg-cream px-4 py-3.5 text-base leading-relaxed">
          {value.trim().length === 0 ? (
            <p className="text-sm text-ink/30">
              가릴 부분을 끌어서 고르고 빈칸을 누릅니다.
            </p>
          ) : (
            <p className="whitespace-pre-wrap">
              <ClozePreview tokens={parseCloze(value)} revealed={revealed} />
            </p>
          )}
        </div>

        <p className="mt-2 text-right text-xs text-umber/45">
          {blanks === 0 ? "빈칸을 하나 이상" : `빈칸 ${blanks}개`}
        </p>
      </div>
    </div>
  );
}

function ClozePreview({
  tokens,
  revealed,
}: {
  tokens: ClozeToken[];
  revealed: boolean;
}) {
  return (
    <>
      {tokens.map((token, index) => (
        <span
          key={index}
          className={cn(
            token.bold && "font-semibold",
            token.highlight && "bg-[#FDF3B0]",
            token.blank &&
              cn(
                "underline decoration-taupe underline-offset-[6px]",
                revealed ? "font-semibold text-ink" : "text-ink/25",
              ),
          )}
        >
          {token.blank && !revealed
            ? token.hint
              ? ` ${token.hint} `
              : "　　　"
            : token.text}
        </span>
      ))}
    </>
  );
}

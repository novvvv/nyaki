import type { Editor } from "@tiptap/core";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ClozeRichEditor from "./cloze-rich-editor";

/**
 * 서식 편집기 — 고른 글자에 표시를 걸면 원문이 그렇게 바뀐다.
 *
 * 키보드 입력 · 한글 조합은 jsdom이 흉내 내지 못해 여기서 보지 않는다. 여기서
 * 지키는 것은 편집기 표시와 원문 사이의 연결이다. 변환 규칙 자체는
 * lib/cloze-doc.test.ts가 본다.
 */

async function setup(value: string) {
  const onChange = vi.fn();
  let editor: Editor | null = null;
  const view = render(
    <ClozeRichEditor
      value={value}
      onChange={onChange}
      editable
      onEditor={(next) => {
        editor = next;
      }}
    />,
  );
  await waitFor(() => expect(editor).not.toBeNull());
  return { onChange, editor: editor as unknown as Editor, view };
}

/** 문서에서 글자 text가 시작하는 위치(ProseMirror 좌표). */
function positionOf(editor: Editor, text: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return;
    const index = node.text!.indexOf(text);
    if (index >= 0) found = pos + index;
  });
  if (found < 0) throw new Error(`${text}를 찾지 못했다`);
  return found;
}

function select(editor: Editor, text: string) {
  const from = positionOf(editor, text);
  act(() => {
    editor.commands.setTextSelection({ from, to: from + text.length });
  });
}

describe("서식 편집기", () => {
  it("원문을 서식으로 그린다 — 기호는 보이지 않는다", async () => {
    const { view } = await setup("앞 **굵게** {{c1::답}} ++밑줄++");
    const root = view.container.querySelector(".cloze-rich")!;

    expect(root.textContent).toBe("앞 굵게 답 밑줄");
    expect(root.querySelector("strong")?.textContent).toBe("굵게");
    expect(root.querySelector("[data-blank]")?.textContent).toBe("답");
    expect(root.querySelector("u")?.textContent).toBe("밑줄");
  });

  it("고른 글자에 빈칸을 걸면 원문이 {{c1::}}로 바뀐다", async () => {
    const { editor, onChange } = await setup("TCP는 연결 지향 프로토콜이다");

    select(editor, "연결 지향");
    act(() => {
      editor.chain().focus().toggleMark("blank").run();
    });

    expect(onChange).toHaveBeenLastCalledWith("TCP는 {{c1::연결 지향}} 프로토콜이다");
  });

  it("굵게 · 형광 · 밑줄도 같은 식으로 걸린다", async () => {
    const { editor, onChange } = await setup("가 나 다");

    select(editor, "가");
    act(() => {
      editor.chain().focus().toggleBold().run();
    });
    select(editor, "나");
    act(() => {
      editor.chain().focus().toggleHighlight().run();
    });
    select(editor, "다");
    act(() => {
      editor.chain().focus().toggleUnderline().run();
    });

    expect(onChange).toHaveBeenLastCalledWith("**가** ==나== ++다++");
  });

  it("표를 넣으면 원문에 제목 행이 있는 표가 생긴다", async () => {
    const { editor, onChange } = await setup("");

    act(() => {
      editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    });

    expect(onChange.mock.lastCall?.[0]).toContain("|   |   |\n| --- | --- |\n|   |   |");
  });

  it("바깥에서 원문이 바뀌면 다시 그리고, 그걸 다시 올리지는 않는다", async () => {
    const { view, onChange } = await setup("처음");

    view.rerender(
      <ClozeRichEditor
        value="코드 칸에서 **고침**"
        onChange={onChange}
        editable
        onEditor={() => {}}
      />,
    );

    const root = view.container.querySelector(".cloze-rich")!;
    await waitFor(() => expect(root.textContent).toBe("코드 칸에서 고침"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("열기만 해서는 원문을 바꾸지 않는다 — 표가 있어도", async () => {
    const { onChange } = await setup("앞\n| 가 | 나 |\n| --- | --- |\n| 다 | 라 |");
    expect(onChange).not.toHaveBeenCalled();
  });
});

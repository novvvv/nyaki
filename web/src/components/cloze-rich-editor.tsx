"use client";

import { Mark, mergeAttributes, type Editor } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import { docToMarkup, markupToDoc } from "@/lib/cloze-doc";

/** 빈칸 — 가릴 글자에 거는 표시. 원문의 `{{cN::답::힌트}}`다. */
const Blank = Mark.create({
  name: "blank",
  // 빈칸 끝에서 이어 쳐도 빈칸이 늘어나지 않게. 답 뒤에 문장을 이어 쓰는 일이 잦다.
  inclusive: false,
  addAttributes() {
    return {
      // 힌트는 여기서 만들 수 없고(코드 칸에서 쓴다) 있으면 그대로 지킨다.
      hint: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-hint"),
        renderHTML: (attributes) =>
          attributes.hint ? { "data-hint": attributes.hint } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-blank]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-blank": "", class: "cloze-blank" }),
      0,
    ];
  },
});

/**
 * 빈칸 노트 서식 편집기 — 기호 없이 보이는 그대로 쓴다.
 *
 * 저장하는 값은 여전히 원문 문자열이다. 고칠 때마다 원문으로 바꿔 올리고
 * (docToMarkup), 바깥에서 원문이 바뀌면(코드 칸에서 고침, 노트를 늦게 받음)
 * 다시 그린다(markupToDoc). 자기가 올린 값은 다시 그리지 않는다 — 그러면
 * 커서가 맨 앞으로 튄다.
 *
 * 노트에 쓰는 것만 켠다(굵게 · 형광 · 밑줄 · 빈칸 · 표). 다른 데서 붙여 넣은
 * 제목 · 목록 · 기울임은 원문으로 쓸 수 없어 그냥 글자로 들어온다.
 */
export default function ClozeRichEditor({
  value,
  onChange,
  editable,
  onEditor,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 가리기(정답 숨김) 중에는 고칠 수 없다 — 안 보이는 글자를 고치게 된다. */
  editable: boolean;
  /** 툴바가 편집기를 다루도록 위로 넘긴다. */
  onEditor: (editor: Editor | null) => void;
}) {
  const emitted = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        // 표 뒤에 빈 문단을 저절로 붙이면 노트를 열기만 해도 원문이 바뀐다.
        trailingNode: false,
      }),
      Highlight,
      Blank,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({
        placeholder: "가릴 부분을 끌어서 고르고 빈칸을 누릅니다.",
      }),
    ],
    content: markupToDoc(value),
    // 서버에서 그리지 않는다 — 그리면 하이드레이션이 어긋난다.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "cloze-rich",
        "aria-label": "빈칸 문장",
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = docToMarkup(current.getJSON());
      // 글은 그대로인데 이벤트만 온 경우(편집 가능 여부 바뀜 등)는 올리지 않는다 —
      // 열기만 해도 "고쳤음"이 되어 저장 버튼이 켜진다.
      if (next === emitted.current) return;
      emitted.current = next;
      onChange(next);
    },
  });

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(markupToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    // 두 번째 인자 false — 바뀜 이벤트를 내지 않는다(기본은 낸다).
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  useEffect(() => {
    onEditor(editor ?? null);
    return () => onEditor(null);
  }, [editor, onEditor]);

  return <EditorContent editor={editor} />;
}

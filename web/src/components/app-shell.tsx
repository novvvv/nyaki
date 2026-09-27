"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

/**
 * 사이드바의 단어장 한 줄. 끌어서 순서를 바꾼다.
 *
 * 줄 전체가 링크라, 끄는 손잡이를 따로 두지 않으면 옮기려던 손짓이 클릭이 된다.
 * 손잡이는 평소에 숨기고 마우스를 올렸을 때만 보인다.
 */
function SidebarItem({
  id,
  href,
  label,
  meta,
  active,
}: {
  id: string;
  href: string;
  label: string;
  meta?: string;
  active: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-10 opacity-80")}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${label} 순서 바꾸기`}
        className="absolute left-0 top-1/2 flex h-6 w-4 -translate-y-1/2 cursor-grab items-center justify-center text-ink/25 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span aria-hidden className="text-[11px] leading-none">
          ⠿
        </span>
      </button>

      <Link
        href={href}
        className={cn(
          "flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition",
          active
            ? "bg-subtle font-medium text-ink"
            : "text-umber/65 hover:bg-subtle/70 hover:text-ink",
        )}
      >
        <span className="truncate">{label}</span>
        {meta ? (
          <span className="ml-2 shrink-0 text-xs text-ink/35">{meta}</span>
        ) : null}
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { wordBooks, summaries, loading, reorderWordBooks } = useVocab();
  const showSidebar = pathname !== "/word-books/overview";

  // 8px은 끌기 시작으로 본다. 이게 없으면 클릭이 드래그로 잡혀 링크가 안 열린다.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = wordBooks.findIndex((book) => book.id === active.id);
    const to = wordBooks.findIndex((book) => book.id === over.id);
    void reorderWordBooks(from, to);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-7xl">
      {showSidebar ? (
        <aside className="hidden w-52 shrink-0 border-r border-taupe/30 py-14 pl-6 pr-3 lg:block">
          <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-wider text-ink/35">
            단어장
          </p>

          <nav className="space-y-0.5">
            {loading ? (
              <p className="px-2.5 py-1.5 text-xs text-ink/35">불러오는 중…</p>
            ) : wordBooks.length === 0 ? (
              <p className="px-2.5 py-1.5 text-xs text-ink/35">비어 있음</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={wordBooks.map((book) => book.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {wordBooks.map((book) => {
                    const href = `/word-books/${book.id}`;
                    return (
                      <SidebarItem
                        key={book.id}
                        id={book.id}
                        href={href}
                        label={book.title}
                        meta={`${summaries[book.id]?.itemCount ?? 0}`}
                        active={
                          pathname === href || pathname.startsWith(`${href}/`)
                        }
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </nav>
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

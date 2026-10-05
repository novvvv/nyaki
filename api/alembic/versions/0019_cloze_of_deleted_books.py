"""지운 단어장에 남은 빈칸 노트 · 빈칸 카드 정리

Revision ID: 0019_cloze_of_deleted_books
Revises: 0018_pack_imports
Create Date: 2026-10-06

단어장을 지울 때 단어와 단어 카드만 지우고 빈칸 노트와 그 카드는 남겨뒀다.
코드는 같은 커밋에서 고쳤지만, 그 전에 지운 단어장의 빈칸 노트는 살아 있는
채로 남아 있다. 그것들을 "지워짐"으로 바꾼다.

다른 삭제처럼 표시만 바꾸고 행은 지우지 않는다. 동기화 기록은 남기지 않는다 —
앱은 단어장 삭제를 받으면 안의 것을 함께 정리하고, 웹은 목록을 다시 받는다.

되돌리기는 하지 않는다. 원래 지웠어야 할 데이터라 되살릴 이유가 없다.

SQL에 콜론을 쓰지 않는다. sa.text가 바인드 파라미터로 읽는다(0012 사고 참고).
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_cloze_of_deleted_books"
down_revision = "0018_pack_imports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 카드를 먼저 지운다. 노트를 먼저 지우면 "지운 단어장의 살아 있는 노트"라는
    # 조건으로 카드를 찾을 수 없다 — 그래서 카드는 단어장 기준으로 바로 찾는다.
    op.execute(
        sa.text(
            """
            UPDATE cards
            SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE is_deleted = FALSE
              AND note_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM cloze_notes n
                JOIN word_books b
                  ON b.id = n.word_book_id AND b.user_id = n.user_id
                WHERE n.id = cards.note_id
                  AND n.user_id = cards.user_id
                  AND b.is_deleted = TRUE
              )
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE cloze_notes
            SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE is_deleted = FALSE
              AND EXISTS (
                SELECT 1
                FROM word_books b
                WHERE b.id = cloze_notes.word_book_id
                  AND b.user_id = cloze_notes.user_id
                  AND b.is_deleted = TRUE
              )
            """
        )
    )


def downgrade() -> None:
    # 지웠어야 할 것을 지운 것이라 되살리지 않는다.
    pass

"""단어장 직접 정렬

Revision ID: 0016_word_book_sort_order
Revises: 0015_drop_recall_cards
Create Date: 2026-09-28

단어장 목록이 생성일 순서로 고정돼 있었다. 자주 보는 단어장을 위로 올릴 방법이
없어서, 사용자가 끌어서 직접 정하게 한다.

sort_order는 실수다. 3번과 4번 사이로 옮기면 3.5를 주면 되므로 **옮긴 행 하나만**
쓰면 된다. 정수라면 아래 행들의 번호를 전부 다시 써야 하고, 그 변경이 오프라인
동기화에 한꺼번에 밀려 올라간다.

기존 행은 생성일 순서대로 1, 2, 3…을 받는다. 그래야 지금 보이는 순서가 그대로
유지된다. null이면 정렬에서 맨 뒤로 가므로 백필을 빼먹으면 순서가 뒤집힌다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_word_book_sort_order"
down_revision = "0015_drop_recall_cards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "word_books", sa.Column("sort_order", sa.Float(), nullable=True)
    )

    # 사용자별로 생성일 순서대로 1부터. 윈도 함수는 UPDATE에 직접 못 쓰므로
    # 서브쿼리로 번호를 매겨 join한다.
    op.execute(
        sa.text(
            """
            UPDATE word_books AS b
            SET sort_order = numbered.position
            FROM (
                SELECT
                    id,
                    user_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id ORDER BY created_at, id
                    ) AS position
                FROM word_books
            ) AS numbered
            WHERE b.id = numbered.id AND b.user_id = numbered.user_id
            """
        )
    )


def downgrade() -> None:
    op.drop_column("word_books", "sort_order")

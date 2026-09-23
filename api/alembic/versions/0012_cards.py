"""cards 테이블 + word_books.card_kinds

Revision ID: 0012_cards
Revises: 0011_learning_steps
Create Date: 2026-09-24

SRS 상태를 단어에서 **카드**로 옮긴다. 안키의 Note/Card 구분과 같다.

같은 단어라도 "単語 → 뜻"과 "뜻 → 単語"는 익는 속도가 다르다. 지금은 단어 행에
srs_* 가 하나뿐이라 방향을 나눌 수 없었다.

**기존 단어는 recognition 카드 한 장으로 옮긴다.** srs_* 값을 그대로 복사하므로
복습 일정이 바뀌지 않는다. words.srs_* 는 지우지 않는다 — 앱이 아직 단어 단위로
동기화하고 있어서 한동안 둘 다 유지해야 한다(동기화 전환 후 제거).

id는 `{word_id}:{kind}`. 클라이언트도 같은 규칙으로 계산할 수 있어야 한다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_cards"
down_revision = "0011_learning_steps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cards",
        sa.Column("id", sa.String(length=120), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("word_id", sa.String(length=80), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column(
            "srs_ease_factor", sa.Float(), nullable=False, server_default="2.5"
        ),
        sa.Column(
            "srs_interval_days", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "srs_repetitions", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("srs_lapses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("srs_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "srs_last_reviewed_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("srs_learning_step", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "is_deleted", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.PrimaryKeyConstraint("id", "user_id"),
    )
    op.create_index("ix_cards_user_due", "cards", ["user_id", "srs_due_at"])
    op.create_index("ix_cards_user_word", "cards", ["user_id", "word_id"])
    op.create_index("ix_cards_user_updated", "cards", ["user_id", "updated_at"])

    op.add_column(
        "word_books", sa.Column("card_kinds", sa.String(length=120), nullable=True)
    )

    # 기존 단어 → recognition 카드 1장. 복습 일정을 그대로 가져간다.
    op.execute(
        """
        INSERT INTO cards (
            id, user_id, word_id, kind,
            srs_ease_factor, srs_interval_days, srs_repetitions, srs_lapses,
            srs_due_at, srs_last_reviewed_at, srs_learning_step,
            created_at, updated_at, is_deleted
        )
        SELECT
            id || ':recognition', user_id, id, 'recognition',
            srs_ease_factor, srs_interval_days, srs_repetitions, srs_lapses,
            srs_due_at, srs_last_reviewed_at, srs_learning_step,
            created_at, updated_at, is_deleted
        FROM words
        """
    )


    # 채점 기록도 카드 단위가 된다. 기존 기록은 recognition 카드로 본다.
    op.add_column(
        "review_logs", sa.Column("card_id", sa.String(length=120), nullable=True)
    )
    op.execute("UPDATE review_logs SET card_id = word_id || ':recognition'")


def downgrade() -> None:
    op.drop_column("review_logs", "card_id")
    op.drop_column("word_books", "card_kinds")
    op.drop_index("ix_cards_user_updated", table_name="cards")
    op.drop_index("ix_cards_user_word", table_name="cards")
    op.drop_index("ix_cards_user_due", table_name="cards")
    op.drop_table("cards")

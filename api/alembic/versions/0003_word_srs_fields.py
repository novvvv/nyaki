"""add word srs fields

Revision ID: 0003_word_srs_fields
Revises: 0002_word_bookmark_tags
Create Date: 2026-07-31
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_word_srs_fields"
down_revision = "0002_word_bookmark_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("words", sa.Column("srs_ease_factor", sa.Float(), nullable=True))
    op.add_column("words", sa.Column("srs_interval_days", sa.Integer(), nullable=True))
    op.add_column("words", sa.Column("srs_repetitions", sa.Integer(), nullable=True))
    op.add_column("words", sa.Column("srs_lapses", sa.Integer(), nullable=True))
    op.add_column(
        "words", sa.Column("srs_due_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "words",
        sa.Column("srs_last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    words = sa.table(
        "words",
        sa.column("srs_ease_factor", sa.Float()),
        sa.column("srs_interval_days", sa.Integer()),
        sa.column("srs_repetitions", sa.Integer()),
        sa.column("srs_lapses", sa.Integer()),
        sa.column("srs_due_at", sa.DateTime(timezone=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("memorization_status", sa.String()),
    )

    # 기본값 backfill — 신규 컬럼과 동일한 기본값, due는 즉시 due(SRS-PLAN.md 마이그레이션 1)
    op.execute(
        words.update().values(
            srs_ease_factor=2.5,
            srs_interval_days=0,
            srs_repetitions=0,
            srs_lapses=0,
            srs_due_at=words.c.created_at,
        )
    )

    # 이미 memorized인 단어는 Good 2회 통과 상태로 소급 (즉시 due 폭주 완화, SRS-PLAN.md 마이그레이션 2)
    op.execute(
        words.update()
        .where(words.c.memorization_status == "memorized")
        .values(
            srs_repetitions=2,
            srs_interval_days=3,
            srs_due_at=sa.text("now() + interval '3 days'"),
        )
    )

    op.alter_column(
        "words", "srs_ease_factor", nullable=False, server_default="2.5"
    )
    op.alter_column("words", "srs_interval_days", nullable=False, server_default="0")
    op.alter_column("words", "srs_repetitions", nullable=False, server_default="0")
    op.alter_column("words", "srs_lapses", nullable=False, server_default="0")
    op.alter_column("words", "srs_due_at", nullable=False)

    op.create_index("ix_words_user_due", "words", ["user_id", "srs_due_at"])


def downgrade() -> None:
    op.drop_index("ix_words_user_due", table_name="words")
    op.drop_column("words", "srs_last_reviewed_at")
    op.drop_column("words", "srs_due_at")
    op.drop_column("words", "srs_lapses")
    op.drop_column("words", "srs_repetitions")
    op.drop_column("words", "srs_interval_days")
    op.drop_column("words", "srs_ease_factor")

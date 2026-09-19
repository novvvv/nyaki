"""add review_logs

Revision ID: 0009_review_logs
Revises: 0008_capelin_balance
Create Date: 2026-09-15

채점 한 번의 기록. 웹 복습 기능이 세션 끝에 채점을 모아 보내는데,
같은 요청이 재전송돼도 한 번만 반영되어야 한다(docs/WEB-REVIEW-PLAN.md 3절).

id를 클라이언트가 만들어 보내고 PK로 쓰는 것이 핵심이다 — 중복이 애플리케이션
로직이 아니라 DB 제약에서 막힌다. Anki가 revlog.id에 복습 시각(epoch ms)을
넣어 쓰는 방식과 같다.

부수 효과로 학습 통계(오늘 복습한 개수, 단계별 분포)의 원본이 생긴다.
지금은 단어의 현재 상태만 있어서 그런 집계를 못 만든다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_review_logs"
down_revision = "0008_capelin_balance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "review_logs",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("word_id", sa.String(length=80), nullable=False),
        sa.Column("grade", sa.String(length=16), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", "user_id"),
    )
    op.create_index(
        "ix_review_logs_user_created", "review_logs", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_review_logs_user_word", "review_logs", ["user_id", "word_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_review_logs_user_word", table_name="review_logs")
    op.drop_index("ix_review_logs_user_created", table_name="review_logs")
    op.drop_table("review_logs")

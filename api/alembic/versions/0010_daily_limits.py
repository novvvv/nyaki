"""add daily_new_limit / daily_review_limit

Revision ID: 0010_daily_limits
Revises: 0009_review_logs
Create Date: 2026-09-23

안키의 "새 카드/일", "최대 복습량/일"에 해당하는 하루 한도.

지금은 단어를 만들면 srs_due_at = created_at이라 그 순간 전부 복습 대상이 된다.
팩으로 300개를 받으면 300개가 오늘 due로 잡힌다. 안키는 이걸 신규 카드 한도로
막는다(하루 20개씩 꺼내 쓴다).

null이면 기본값(신규 10 / 복습 무제한). 기존 사용자도 마이그레이션 없이 그대로
기본값이 적용된다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_daily_limits"
down_revision = "0009_review_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_progress", sa.Column("daily_new_limit", sa.Integer(), nullable=True)
    )
    op.add_column(
        "user_progress", sa.Column("daily_review_limit", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("user_progress", "daily_review_limit")
    op.drop_column("user_progress", "daily_new_limit")

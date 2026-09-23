"""add srs_learning_step + 복습 흐름 설정

Revision ID: 0011_learning_steps
Revises: 0010_daily_limits
Create Date: 2026-09-23

안키의 Learning steps / Relearning steps / Graduating interval.

words.srs_learning_step — 지금 몇 번째 단계인지. null이면 학습 단계가 아니다.
기존 단어는 전부 null로 시작하며, 설정을 켜기 전까지 동작이 바뀌지 않는다.

user_progress의 세 컬럼 — 단계 목록은 "1,10"처럼 분 단위를 쉼표로 잇는다.
빈 문자열/null이면 단계를 쓰지 않는다(기존 동작).
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_learning_steps"
down_revision = "0010_daily_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("words", sa.Column("srs_learning_step", sa.Integer(), nullable=True))
    op.add_column(
        "user_progress", sa.Column("learning_steps", sa.String(length=120), nullable=True)
    )
    op.add_column(
        "user_progress",
        sa.Column("relearning_steps", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "user_progress",
        sa.Column("graduating_interval_days", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_progress", "graduating_interval_days")
    op.drop_column("user_progress", "relearning_steps")
    op.drop_column("user_progress", "learning_steps")
    op.drop_column("words", "srs_learning_step")

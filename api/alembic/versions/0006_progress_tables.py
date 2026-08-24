"""create gamification progress tables (user_progress, quest_states)

Revision ID: 0006_progress_tables
Revises: 0005_posts_rename
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_progress_tables"
down_revision = "0005_posts_rename"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_progress",
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("churu_balance", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("streak_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_active_date", sa.Date(), nullable=True),
        sa.Column("daily_review_goal", sa.Integer(), nullable=True),
        sa.Column("morning_review_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("evening_review_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "quest_states",
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("quest_id", sa.String(length=50), nullable=False),
        sa.Column("last_completed_date", sa.Date(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "quest_id"),
    )


def downgrade() -> None:
    op.drop_table("quest_states")
    op.drop_table("user_progress")

"""add capelin balance to user_progress

Revision ID: 0008_capelin_balance
Revises: 0007_word_example_meaning
Create Date: 2026-09-06

열빙어는 실제 복습에만 나오는 두 번째 재화라 츄르와 잔액을 따로 둔다
(ARCHITECTURE.md 1.2). 기존 row는 server_default로 0이 채워진다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_capelin_balance"
down_revision = "0007_word_example_meaning"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_progress",
        sa.Column(
            "capelin_balance",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("user_progress", "capelin_balance")

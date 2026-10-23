"""터주 — 사용자별 잡은 물고기 기록

Revision ID: 0023_caught_fish
Revises: 0022_fish
Create Date: 2026-10-23

nyaki-web에서 로그인한 사용자가 물고기를 "잡았어요"로 체크한다. 체크 해제는 행을
지우므로 is_deleted가 없다. fish_slug에 외래 키를 걸지 않은 건 fish가 soft delete라
지워진 물고기의 기록도 그대로 남겨 두려는 것이다(되살리면 체크도 돌아온다).
"""

from alembic import op
import sqlalchemy as sa


revision = "0023_caught_fish"
down_revision = "0022_fish"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "caught_fish",
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("fish_slug", sa.String(length=120), nullable=False),
        sa.Column("caught_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "fish_slug"),
    )


def downgrade() -> None:
    op.drop_table("caught_fish")

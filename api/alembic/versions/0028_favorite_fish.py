"""터주 — 사용자별 찜한 물고기

Revision ID: 0028_favorite_fish
Revises: 0027_guestbook
Create Date: 2026-10-26

nyaki-web에서 로그인한 사용자가 물고기를 찜해 두고, 찜한 물고기의 다음 출현을 모아
보거나 알림을 받는다. 잡은 물고기(caught_fish)와 같은 모양 — 찜 해제는 행을 지우고,
fish_slug에 외래 키를 걸지 않는다(fish가 soft delete라 되살리면 찜도 돌아온다).
"""

from alembic import op
import sqlalchemy as sa


revision = "0028_favorite_fish"
down_revision = "0027_guestbook"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "favorite_fish",
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("fish_slug", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "fish_slug"),
    )


def downgrade() -> None:
    op.drop_table("favorite_fish")

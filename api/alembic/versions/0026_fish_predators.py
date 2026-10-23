"""터주 — 밑작(어부의 직감) 조건

Revision ID: 0026_fish_predators
Revises: 0025_fish_spots
Create Date: 2026-10-24

일부 터주는 특정 물고기를 정해진 수만큼 먼저 낚아 "어부의 직감"을 띄워야 나온다.
그 물고기·마리 수(predators, JSON)와 직감 지속 시간(intuition_seconds)을 둔다.
기존 행은 빈 목록·None — 시드를 다시 돌리면 채워진다.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0026_fish_predators"
down_revision = "0025_fish_spots"
branch_labels = None
depends_on = None

JSON_LIST = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column(
        "fish",
        sa.Column("predators", JSON_LIST, server_default=sa.text("'[]'"), nullable=False),
    )
    op.add_column("fish", sa.Column("intuition_seconds", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("fish", "intuition_seconds")
    op.drop_column("fish", "predators")

"""터주 — 생미끼 단계별 입질·챔질

Revision ID: 0024_fish_mooches
Revises: 0023_caught_fish
Create Date: 2026-10-23

예전엔 미끼 경로를 "깔따구 → 구리붕어"처럼 bait 한 칸에 글자로 적어서, 중간 물고기
(구리붕어)를 낚는 입질·챔질을 담을 데가 없었다. 중간 단계를 mooches(JSON 목록)로
나누고 bait에는 처음 미끼만 둔다. 기존 행은 빈 목록 — 시드를 다시 돌리면 채워진다.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0024_fish_mooches"
down_revision = "0023_caught_fish"
branch_labels = None
depends_on = None

JSON_LIST = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column(
        "fish",
        sa.Column("mooches", JSON_LIST, server_default=sa.text("'[]'"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("fish", "mooches")

"""터주 — 물고기가 낚이는 낚시터 전부

Revision ID: 0025_fish_spots
Revises: 0024_fish_mooches
Create Date: 2026-10-23

신생 지역 물고기를 전부 넣으면서, 가재처럼 여러 지역·낚시터에서 나오는 물고기(298마리 중
114마리)를 zone_id·spot_name 한 칸으로는 담을 수 없었다. 전체 목록을 spots(JSON)로
두고, zone_id·spot_name은 대표 낚시터(날씨 계산 기준)로 그대로 쓴다.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0025_fish_spots"
down_revision = "0024_fish_mooches"
branch_labels = None
depends_on = None

JSON_LIST = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column(
        "fish",
        sa.Column("spots", JSON_LIST, server_default=sa.text("'[]'"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("fish", "spots")

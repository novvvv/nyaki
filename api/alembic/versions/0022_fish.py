"""FF14 낚시 물고기(터주) 테이블

Revision ID: 0022_fish
Revises: 0021_cloze_note_bookmark
Create Date: 2026-10-23

nyaki-web의 터주 페이지용. 블로그 글(posts)처럼 사이트 전체가 공유하는 콘텐츠라
user_id가 없다. 날씨·시간 조건을 칸으로 나눠 두어 웹이 다음 출현 시각을 계산하고,
나중에 검색·알림이 같은 칸을 쓴다.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0022_fish"
down_revision = "0021_cloze_note_bookmark"
branch_labels = None
depends_on = None

# 운영은 JSONB(words.tags와 같음). SQLite로 이 리비전만 검증할 수 있게 variant로 둔다.
JSON_LIST = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "fish",
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("icon_id", sa.Integer(), server_default="0", nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("name_en", sa.String(length=200), server_default="", nullable=False),
        sa.Column("name_ja", sa.String(length=200), server_default="", nullable=False),
        sa.Column("zone_id", sa.Integer(), nullable=False),
        sa.Column("spot_name", sa.String(length=200), nullable=False),
        sa.Column("water", sa.String(length=40), server_default="", nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("stars", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_legendary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_big_fish", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("start_hour", sa.Float(), nullable=True),
        sa.Column("end_hour", sa.Float(), nullable=True),
        sa.Column("weathers", JSON_LIST, server_default=sa.text("'[]'"), nullable=False),
        sa.Column("previous_weathers", JSON_LIST, server_default=sa.text("'[]'"), nullable=False),
        sa.Column("bait", sa.String(length=200), server_default="", nullable=False),
        sa.Column("tug", sa.String(length=5), server_default="", nullable=False),
        sa.Column("hookset", sa.String(length=50), server_default="", nullable=False),
        sa.Column("buffs", JSON_LIST, server_default=sa.text("'[]'"), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("slug"),
        sa.UniqueConstraint("item_id"),
    )
    op.create_index("ix_fish_zone_id", "fish", ["zone_id"])


def downgrade() -> None:
    op.drop_index("ix_fish_zone_id", table_name="fish")
    op.drop_table("fish")

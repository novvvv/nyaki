"""카드 사진 — 단어에 R2 사진 키

Revision ID: 0029_word_photo
Revises: 0028_favorite_fish
Create Date: 2026-11-23

유료 기능. 사진 파일은 Cloudflare R2에 두고 여기는 키만 적는다. 서버만 쓰는
칸이다 — 클라이언트가 보내는 image_path(앱에 내장된 그림 경로)와 섞지 않는다.
웹은 단어를 저장할 때 image_path를 null로 보내서, 같은 칸을 쓰면 사진이 지워진다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0029_word_photo"
down_revision = "0028_favorite_fish"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("words", sa.Column("photo_key", sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column("words", "photo_key")

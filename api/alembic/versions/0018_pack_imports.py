"""단어 묶음 담기 기록

Revision ID: 0018_pack_imports
Revises: 0017_folders
Create Date: 2026-10-06

단어 다운로드에서 묶음을 내 단어장에 담으면 "누가 어떤 묶음을 어느 단어장에
담았는지" 남긴다. 같은 묶음을 다시 담으려 할 때 화면이 경고를 띄우는 데 쓴다.

id는 클라이언트가 만든다. 응답이 끊겨 같은 요청이 다시 와도 이 id로 알아보고
단어를 두 번 넣지 않는다.

is_deleted · updated_at이 없다. 만든 뒤 고치거나 지우지 않고 동기화도 하지
않는다. 담은 단어장이 지워지면 조회할 때 걸러낸다.

외래키는 다른 테이블과 같은 이유(0017 참고)로 걸지 않는다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0018_pack_imports"
down_revision = "0017_folders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pack_imports",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("pack_id", sa.String(length=120), nullable=False),
        sa.Column("word_book_id", sa.String(length=80), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", "user_id"),
    )
    op.create_index(
        "ix_pack_imports_user_imported", "pack_imports", ["user_id", "imported_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_pack_imports_user_imported", table_name="pack_imports")
    op.drop_table("pack_imports")

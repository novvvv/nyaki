"""폴더 — 단어장의 상위 개념

Revision ID: 0017_folders
Revises: 0016_word_book_sort_order
Create Date: 2026-09-28

단어장이 늘어나면서 묶을 곳이 필요해졌다. 한 단계뿐이다 — 폴더 안에 폴더를 넣지
않는다. 트리 이동과 순환 참조 방지가 붙는데 개인 단어장 몇십 개에 그만한 구조가
필요하지 않다.

단어장은 폴더에 **안 속해도 된다**(folder_id null). 기존 단어장을 전부 어딘가에
넣도록 강제하지 않기 위해서다. 그래서 백필도 없다.

외래키를 걸지 않는다. 이 스키마는 (id, user_id) 복합 PK를 쓰고 오프라인
클라이언트가 만든 행이 순서를 뒤바꿔 올라올 수 있어서, 단어장→단어도 같은 이유로
FK 없이 간다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_folders"
down_revision = "0016_word_book_sort_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("sort_order", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "is_deleted", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.PrimaryKeyConstraint("id", "user_id"),
    )
    op.create_index("ix_folders_user_updated", "folders", ["user_id", "updated_at"])

    op.add_column(
        "word_books", sa.Column("folder_id", sa.String(length=80), nullable=True)
    )
    op.create_index(
        "ix_word_books_folder", "word_books", ["user_id", "folder_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_word_books_folder", table_name="word_books")
    op.drop_column("word_books", "folder_id")
    op.drop_index("ix_folders_user_updated", table_name="folders")
    op.drop_table("folders")

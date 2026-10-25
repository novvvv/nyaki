"""방명록

Revision ID: 0027_guestbook
Revises: 0026_fish_predators
Create Date: 2026-10-26

nyaki-web 방명록. 구글 로그인한 사용자가 짧은 글을 남긴다. 작성자 이름은 쓸 때의 구글
표시 이름을 그대로 저장한다. 지우면 행을 지우므로 is_deleted가 없다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0027_guestbook"
down_revision = "0026_fish_predators"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "guestbook_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("author_name", sa.String(length=60), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_guestbook_entries_user_id", "guestbook_entries", ["user_id"])
    op.create_index("ix_guestbook_entries_created_at", "guestbook_entries", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_guestbook_entries_created_at", table_name="guestbook_entries")
    op.drop_index("ix_guestbook_entries_user_id", table_name="guestbook_entries")
    op.drop_table("guestbook_entries")

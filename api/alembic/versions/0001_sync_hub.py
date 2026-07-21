"""create sync hub tables

Revision ID: 0001_sync_hub
Revises:
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_sync_hub"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "word_books",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("id", "user_id"),
    )
    op.create_index("ix_word_books_user_updated", "word_books", ["user_id", "updated_at"])
    op.create_table(
        "words",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("word_book_id", sa.String(length=80), nullable=False),
        sa.Column("term", sa.String(length=500), nullable=False),
        sa.Column("meaning", sa.Text(), nullable=False),
        sa.Column("pronunciation", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("example", sa.Text(), nullable=True),
        sa.Column("image_path", sa.Text(), nullable=True),
        sa.Column("memorization_status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("id", "user_id"),
    )
    op.create_index("ix_words_user_updated", "words", ["user_id", "updated_at"])
    op.create_index("ix_words_book", "words", ["user_id", "word_book_id"])
    op.create_table(
        "sync_changes",
        sa.Column("cursor", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("entity_type", sa.String(length=20), nullable=False),
        sa.Column("entity_id", sa.String(length=80), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("cursor"),
    )
    op.create_index("ix_sync_changes_user_cursor", "sync_changes", ["user_id", "cursor"])


def downgrade() -> None:
    op.drop_table("sync_changes")
    op.drop_table("words")
    op.drop_table("word_books")

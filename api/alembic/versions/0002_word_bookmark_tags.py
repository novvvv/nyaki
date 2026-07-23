"""add word bookmark and tags

Revision ID: 0002_word_bookmark_tags
Revises: 0001_sync_hub
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_word_bookmark_tags"
down_revision = "0001_sync_hub"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "words",
        sa.Column(
            "is_bookmarked",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "words",
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.create_index("ix_words_user_bookmarked", "words", ["user_id", "is_bookmarked"])


def downgrade() -> None:
    op.drop_index("ix_words_user_bookmarked", table_name="words")
    op.drop_column("words", "tags")
    op.drop_column("words", "is_bookmarked")

"""create nyaki-web content tables (artists, songs)

Revision ID: 0004_content_tables
Revises: 0003_word_srs_fields
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_content_tables"
down_revision = "0003_word_srs_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "artists",
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("slug"),
    )
    op.create_table(
        "songs",
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("artist_slug", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("slug"),
    )
    op.create_index("ix_songs_artist_slug", "songs", ["artist_slug"])
    op.create_index("ix_songs_posted_at", "songs", ["posted_at"])


def downgrade() -> None:
    op.drop_index("ix_songs_posted_at", table_name="songs")
    op.drop_index("ix_songs_artist_slug", table_name="songs")
    op.drop_table("songs")
    op.drop_table("artists")

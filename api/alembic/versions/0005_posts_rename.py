"""rename songs -> posts, add kind, make artist_slug nullable

기존 songs 데이터(테스트용 글 1개)는 보존할 필요 없다고 판단해 drop 후 재생성한다.

Revision ID: 0005_posts_rename
Revises: 0004_content_tables
Create Date: 2026-08-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_posts_rename"
down_revision = "0004_content_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("songs")
    op.create_table(
        "posts",
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=20), server_default="song", nullable=False),
        sa.Column("artist_slug", sa.String(length=120), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("slug"),
    )
    op.create_index("ix_posts_artist_slug", "posts", ["artist_slug"])
    op.create_index("ix_posts_posted_at", "posts", ["posted_at"])


def downgrade() -> None:
    op.drop_index("ix_posts_posted_at", table_name="posts")
    op.drop_index("ix_posts_artist_slug", table_name="posts")
    op.drop_table("posts")
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

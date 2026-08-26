"""add word example_meaning

Revision ID: 0007_word_example_meaning
Revises: 0006_progress_tables
Create Date: 2026-08-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_word_example_meaning"
down_revision = "0006_progress_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "words",
        sa.Column("example_meaning", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("words", "example_meaning")

"""빈칸 노트 즐겨찾기

Revision ID: 0021_cloze_note_bookmark
Revises: 0020_attendance_logs
Create Date: 2026-10-16

테스트 중에 카드를 저장(즐겨찾기)할 수 있게 한다. 단어에는 처음부터 있던 칸이고
(0002), 빈칸 노트에만 없었다. 단어와 같은 모양으로 둔다.

기존 행은 false다. 저장한 적이 없으니 그대로 맞다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_cloze_note_bookmark"
down_revision = "0020_attendance_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cloze_notes",
        sa.Column(
            "is_bookmarked",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("cloze_notes", "is_bookmarked")

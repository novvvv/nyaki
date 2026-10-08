"""출석 기록

Revision ID: 0020_attendance_logs
Revises: 0019_cloze_of_deleted_books
Create Date: 2026-10-08

하루 한 번 출석하면 츄르를 준다. 날짜별로 한 줄씩 남긴다.

기존 퀘스트 테이블(quest_states)에 끼우지 않는다. 그쪽은 "마지막 완료 날짜" 하나만
남아서 연속 출석을 셀 수 없고, 읽고-판단하고-쓰기라 동시 요청 두 개가 오면 보상이
두 번 들어갈 수 있다. 여기서는 (user_id, date) 기본키가 같은 날 두 번째 줄을 막는다 —
중복 지급 방지를 코드가 아니라 DB가 한다.

date는 **한국 날짜**이고 서버가 받은 시각으로 정한다. 클라이언트가 날짜를 보낼 길이 없다.

고치거나 지우지 않고 동기화하지 않아서 is_deleted · updated_at이 없다.
기본키가 (user_id, date) 순서라 "이 사용자의 최근 출석"을 찾는 데 따로 인덱스가 필요 없다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_attendance_logs"
down_revision = "0019_cloze_of_deleted_books"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_logs",
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("reward", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "date"),
    )


def downgrade() -> None:
    op.drop_table("attendance_logs")

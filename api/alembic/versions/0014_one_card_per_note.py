"""빈칸 노트 하나에 카드 하나

Revision ID: 0014_one_card_per_note
Revises: 0013_cloze_notes
Create Date: 2026-09-27

0013은 안키의 cloze를 그대로 옮겨 빈칸 번호마다 카드를 따로 만들었다(c1, c2 …).
쓰임에 안 맞았다 — "각 빈칸에 알맞은 용어를 쓰시오"는 문제 하나인데 카드 여럿으로
쪼개졌고, 한 카드의 앞면이 다른 카드의 답을 그대로 보여줬다.

이제 노트 하나가 카드 한 장(`kind = 'cloze'`, id는 `{노트id}:cloze`)이다.

기존 c1·c2 … 카드는 **복습 기록을 옮기지 않고 지운다**. 빈칸 노트를 만든 지
얼마 안 돼 잃을 기록이 거의 없고, 어느 빈칸의 기록을 새 카드의 기록으로 삼을지가
자의적이라서다.

**SQL에 콜론을 직접 쓰지 않는다** — 0012에서 `id || ':recognition'`의 `:recognition`을
SQLAlchemy가 바인드 파라미터로 읽어 배포가 깨졌다. 리터럴은 전부 bindparams로 넘긴다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_one_card_per_note"
down_revision = "0013_cloze_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 번호별 카드 제거.
    op.execute(
        sa.text("DELETE FROM cards WHERE source_type = :source").bindparams(
            source="cloze"
        )
    )

    # 살아 있는 노트마다 카드 한 장. 빈칸이 하나도 없는 노트는 물을 게 없어서 뺀다.
    op.execute(
        sa.text(
            """
            INSERT INTO cards (
                id, user_id, source_type, word_id, note_id, kind,
                srs_ease_factor, srs_interval_days, srs_repetitions, srs_lapses,
                srs_due_at, srs_last_reviewed_at, srs_learning_step,
                created_at, updated_at, is_deleted
            )
            SELECT
                n.id || :suffix, n.user_id, :source, NULL, n.id, :kind,
                2.5, 0, 0, 0,
                n.created_at, NULL, NULL,
                n.created_at, n.updated_at, false
            FROM cloze_notes AS n
            WHERE n.is_deleted = false
              AND n.text LIKE :pattern
            """
        ).bindparams(
            suffix=":cloze",
            source="cloze",
            kind="cloze",
            pattern="%{{c%::%}}%",
        )
    )


def downgrade() -> None:
    # 번호별 카드로 되돌리지는 않는다. 원래 기록이 이미 사라졌으므로
    # 여기서 할 수 있는 것은 새로 만든 카드를 치우는 것뿐이다.
    op.execute(
        sa.text("DELETE FROM cards WHERE source_type = :source").bindparams(
            source="cloze"
        )
    )

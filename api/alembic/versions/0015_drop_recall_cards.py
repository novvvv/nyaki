"""recall 카드 정리

Revision ID: 0015_drop_recall_cards
Revises: 0014_one_card_per_note
Create Date: 2026-09-27

단어장별로 카드 종류(단어→뜻 / 뜻→단어)를 고르는 기능을 웹에서 걷어냈다.
쓰지 않는 기능인데 학습량만 두 배로 만들고, 화면 하나를 차지하고 있었다.

화면이 사라졌으니 이제 `recall`을 켤 방법이 없다. 그런데 예전에 켜둔 단어장이
있으면 그 카드들은 계속 출제된다 — 끌 방법 없이. 여기서 정리한다.

컬럼과 서버 코드는 남겨둔다. 기본값이 `recognition` 하나라 동작에 영향이 없고,
컬럼을 지우는 마이그레이션은 되돌리기가 번거롭다. 다시 필요해지면 화면만
되살리면 된다.

recall 카드의 복습 기록은 잃는다. 다시 만들 수 없는 카드라 남겨둬도 쓸 데가 없다.
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_drop_recall_cards"
down_revision = "0014_one_card_per_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text("DELETE FROM cards WHERE kind = :kind").bindparams(kind="recall")
    )
    op.execute(
        sa.text(
            "UPDATE word_books SET card_kinds = :kinds WHERE card_kinds IS NOT NULL"
        ).bindparams(kinds="recognition")
    )


def downgrade() -> None:
    # 지운 카드는 되살릴 수 없다. 단어장 설정도 무엇이 켜져 있었는지 기록이 없다.
    pass

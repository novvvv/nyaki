"""cloze_notes + cards.source_type/note_id

Revision ID: 0013_cloze_notes
Revises: 0012_cards
Create Date: 2026-09-24

빈칸 노트를 **단어의 파생물이 아니라 별개 노트 타입**으로 세운다.

0012에서 cloze를 단어 카드의 한 종류로 넣었는데 잘못된 모델이었다. 그러면
빈칸이 "예문에서 그 단어를 가린 것" 하나로 고정돼, 빈칸을 여럿 찍을 수도
단어가 아닌 문장을 외울 수도 없다.

- cloze_notes: 문장 한 덩이. 문법은 안키와 같은 `{{cN::답}}`
- cards.source_type: 이 카드가 단어에서 왔는지 빈칸 노트에서 왔는지
- cards.word_id는 nullable이 된다 — 빈칸 카드는 note_id를 쓴다
- 잘못 만들어진 단어 cloze 카드는 지운다(사용 전이라 데이터 손실 없음)
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_cloze_notes"
down_revision = "0012_cards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cloze_notes",
        sa.Column("id", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("word_book_id", sa.String(length=80), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "is_deleted", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.PrimaryKeyConstraint("id", "user_id"),
    )
    op.create_index(
        "ix_cloze_notes_user_updated", "cloze_notes", ["user_id", "updated_at"]
    )
    op.create_index(
        "ix_cloze_notes_book", "cloze_notes", ["user_id", "word_book_id"]
    )

    op.add_column(
        "cards",
        sa.Column(
            "source_type", sa.String(length=16), nullable=False, server_default="word"
        ),
    )
    op.add_column("cards", sa.Column("note_id", sa.String(length=80), nullable=True))
    op.alter_column("cards", "word_id", existing_type=sa.String(length=80), nullable=True)

    # 0012에서 만들어졌을 수 있는 단어 cloze 카드 정리. 화면에 노출된 적이
    # 거의 없고, 남겨두면 출처 없는 카드가 계속 출제된다.
    op.execute(sa.text("DELETE FROM cards WHERE kind = :kind").bindparams(kind="cloze"))


def downgrade() -> None:
    op.alter_column(
        "cards", "word_id", existing_type=sa.String(length=80), nullable=False
    )
    op.drop_column("cards", "note_id")
    op.drop_column("cards", "source_type")
    op.drop_index("ix_cloze_notes_book", table_name="cloze_notes")
    op.drop_index("ix_cloze_notes_user_updated", table_name="cloze_notes")
    op.drop_table("cloze_notes")

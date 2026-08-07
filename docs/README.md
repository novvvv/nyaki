# Docs (공개)

포트폴리오 · 협업용으로 저장소에 포함되는 문서.

| 파일 | 내용 |
|------|------|
| [API.md](API.md) | Hub REST / Sync 엔드포인트 |
| [DOMAIN.md](DOMAIN.md) | WordBook · Word 모델과 규칙 |
| [SRS.md](SRS.md) | 망각곡선(SM-2) — 제품 결정 · 계산 로직 · 구현 구조 · 향후 개선 검토 |
| [hub_erd.md](hub_erd.md) | Hub Postgres ERD |

확정 안 된 추후 아이디어(웹 복습 UI, 로컬→클라우드 이관, sync 로그 스케일링 등)는 [SRS.md](SRS.md)의 "향후 개선 검토" 섹션에 모아둔다.

Flutter 앱 **로컬 DB(Drift) ERD**는 루트 [app_erd.md](../app_erd.md) (웹 DB 없음 · Hub는 `api/app/models.py`).

서버 실행·배포는 [api/README.md](../api/README.md) 참고.

개인용 설계·요구사항·BE 메모는 [`notes/`](../notes/README.md) (로컬 전용).

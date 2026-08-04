# Docs (공개)

포트폴리오 · 협업용으로 저장소에 포함되는 문서.

| 파일 | 내용 |
|------|------|
| [API.md](API.md) | Hub REST / Sync 엔드포인트 |
| [DOMAIN.md](DOMAIN.md) | WordBook · Word 모델과 규칙 |
| [SRS-PLAN.md](SRS-PLAN.md) | 망각곡선(SM-2) 복습 플랜 · 향후 개선 검토 |
| [SRS.md](SRS.md) | SM-2 계산 로직 (반올림 규칙·워크스루) |
| [SRS-IMPLEMENTATION.md](SRS-IMPLEMENTATION.md) | SM-2 구현 상세 — 변경된 코드와 로직 흐름 |
| [hub_erd.md](hub_erd.md) | Hub Postgres ERD |

확정 안 된 추후 아이디어(웹 복습 UI, 로컬→클라우드 이관, sync 로그 스케일링 등)는 별도 디렉토리 없이 [SRS-PLAN.md](SRS-PLAN.md)의 "향후 개선 검토" 섹션에 모아둔다.

Flutter 앱 **로컬 DB(Drift) ERD**는 루트 [app_erd.md](../app_erd.md) (웹 DB 없음 · Hub는 `api/app/models.py`).

서버 실행·배포는 [api/README.md](../api/README.md) 참고.

개인용 설계·요구사항·BE 메모는 [`notes/`](../notes/README.md) (로컬 전용).

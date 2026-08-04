# SRS 구현 진행 상황

> 망각곡선(SM-2) 복습 기능 구현 체크리스트. 모듈 단위로 순서대로 진행, 매 모듈 완료 후 승인받고 다음으로 이동.  
> 제품/UX 결정: [docs/SRS-PLAN.md](docs/SRS-PLAN.md) · 계산 로직: [docs/SRS.md](docs/SRS.md)

---

## 모듈 1 — 문서 ✅ 완료

- [x] [docs/SRS-PLAN.md](docs/SRS-PLAN.md) 신규 — 제품/UX 결정, 마이그레이션 계획
- [x] [docs/SRS.md](docs/SRS.md) 신규 — SM-2 계산 로직, 반올림 규칙, 워크스루
- [x] [docs/hub_erd.md](docs/hub_erd.md) 신규 — Hub Postgres ERD
- [x] [docs/DOMAIN.md](docs/DOMAIN.md) — `Word` SRS 필드 추가
- [x] [app_erd.md](app_erd.md) — Drift `WordEntries` SRS 필드 추가
- [x] [docs/API.md](docs/API.md) — Word JSON + `GET /v1/review/due` 문서화
- [x] [docs/README.md](docs/README.md) — SRS.md · hub_erd.md 링크 추가
- [x] `notes/product/features-v0.1.md` — `F-R-01` 항목 추가

---

## 모듈 2 — Hub (백엔드) ✅ 완료

- [x] [api/app/models.py](api/app/models.py) — `WordModel`에 SRS 6컬럼 + `(user_id, srs_due_at)` 인덱스
- [x] [api/alembic/versions/0003_word_srs_fields.py](api/alembic/versions/0003_word_srs_fields.py) — 마이그레이션 (컬럼 추가 → backfill → 기존 memorized 소급 → NOT NULL → 인덱스)
- [x] [api/app/schemas.py](api/app/schemas.py) — `WordPayload` SRS 필드, `srs_due_at` 기본값 처리, `ReviewDueResponse`
- [x] [api/app/services.py](api/app/services.py) — `list_due_words`
- [x] [api/app/routes.py](api/app/routes.py) — `GET /v1/review/due?limit=`
- [x] [api/tests/test_review.py](api/tests/test_review.py) — due 필터링·정렬·soft-delete 제외·limit 테스트
- [x] 로컬 dev Postgres에서 실제 검증: `alembic upgrade head` / `downgrade -1` / 재적용, pytest 전체 통과

---

## 문서 구조 조정 (모듈 사이 후속 작업)

- [x] `docs/plan/` 신규 → 이후 파일 수가 늘어 다시 [docs/SRS-PLAN.md](docs/SRS-PLAN.md) "향후 개선 검토" 섹션으로 병합, 디렉토리 삭제
  - 웹 복습 UI 보류 사유 · 로컬 전용 → 클라우드 전환 시 SM-2 이관 · `sync_changes` 로그 무한 증식 문제 · 알고리즘 개인화(FSRS) 확장 여지, 4개 항목 모두 SRS-PLAN.md에 포함됨
- [x] `sync_changes` 로그 무한 증식 이슈 — **모듈 3~4 배포 전 A(주기적 정리)/B(compaction) 중 결정 필요** (SRS-PLAN.md 참고)

---

## 모듈 3 — SM-2 순수 로직 (Flutter) ✅ 완료

- [x] [lib/data/srs/sm2.dart](lib/data/srs/sm2.dart) — `gradeAgain`/`gradeGood` 계산 함수 ([SRS.md](docs/SRS.md) 스펙 그대로), `Sm2State`/`Sm2GradeResult` 값 타입
- [x] `roundHalfUp` 구현 — 소수 둘째 자리 반올림(`_roundHalfUp2`)에도 재사용
- [x] [test/data/srs/sm2_test.dart](test/data/srs/sm2_test.dart) — SRS.md 워크스루 표 1·2 그대로 테스트 벡터로 사용, `roundHalfUp`/ease 하한선 단위 테스트 포함
- [x] `flutter test test/data/srs/sm2_test.dart` 로컬 실행 통과 확인

---

## 모듈 4 — 앱 (Flutter UI) ✅ 완료 (검증 대기)

- [x] Drift 스키마 버전업 + 마이그레이션 (`lib/data/local/tables.dart`, `app_database.dart` schemaVersion 3→4) — `build_runner` 생성, `flutter analyze`/`flutter test` 통과, 시뮬레이터 실행 확인
- [x] `Word` 모델 · Create/Update · sync JSON에 SRS 필드 반영
  - [lib/models/word.dart](lib/models/word.dart) — SRS 6필드 + `isDue` getter
  - [lib/models/word_book.dart](lib/models/word_book.dart) — `dueWords`/`dueCount` getter
  - [lib/data/repositories/vocab_repository.dart](lib/data/repositories/vocab_repository.dart) — `ReviewGrade` enum, `gradeWord` 추상 메서드
  - [lib/data/repositories/drift_vocab_repository.dart](lib/data/repositories/drift_vocab_repository.dart) — `gradeWord` 구현, `_enqueueWord` payload에 SRS 필드 추가 (+ `#` 주석 문법 오류 수정 — Dart는 `#` 주석을 지원하지 않아 컴파일이 깨지고 있었음)
  - [lib/data/repositories/in_memory_vocab_repository.dart](lib/data/repositories/in_memory_vocab_repository.dart) — `srsDueAt` 필수 필드 대응, `gradeWord` 구현 (테스트 전용)
  - [lib/data/sync/sync_coordinator.dart](lib/data/sync/sync_coordinator.dart) — `_mergeWord`에 SRS 필드 pull 반영
  - [lib/data/vocab_controller.dart](lib/data/vocab_controller.dart) — `gradeWord` 래퍼
- [x] 기존 테스트 세션 화면의 채점을 SM-2로 교체
  - [lib/screens/test/word_test_session_screen.dart](lib/screens/test/word_test_session_screen.dart) — 모름/외움 버튼이 `updateWord(memorizationStatus)` 대신 `gradeWord(ReviewGrade)` 호출. **화면 구성·디자인·좋아요(북마크)·메모 시트·이미지·릴스 액션레일은 전부 그대로 유지**, 채점 경로만 교체
- [x] 출제 기준을 SM-2로 교체 — 전체/모름만/외움만 필터 제거, `Word.isDue`인 단어만 출제
  - [lib/screens/test/word_test_session_screen.dart](lib/screens/test/word_test_session_screen.dart) — `WordTestOptions.selectWords`가 `isDue`로 필터, `WordTestFilter` enum·`filter` 필드 삭제
  - [lib/screens/test/word_test_screen.dart](lib/screens/test/word_test_screen.dart) — 옵션 시트의 필터 칩·`_FilterChip` 제거(뜻 가리기/순서 섞기는 유지), 타일·시작 버튼 숫자를 `dueCount` 기준으로 변경. **단어장 선택 기능은 그대로 유지**
- [x] Again(모름) 즉시 재학습 — 모름을 누르면 곧바로 복습 대상이 되어 다음 테스트에서 바로 출제
  - [lib/data/srs/sm2.dart](lib/data/srs/sm2.dart) — `relearningStep` 상수(기본 `Duration.zero`), `gradeAgain`의 `dueAt`/`intervalDays` 변경
  - [docs/SRS.md](docs/SRS.md) — "당일 재학습 없음" → "즉시 재학습 대상"으로 스펙 개정, 워크스루 표 갱신
  - [test/data/srs/sm2_test.dart](test/data/srs/sm2_test.dart) — Again 테스트 벡터 갱신 + 즉시 due 검증 케이스 추가
  - 진행 중인 세션에는 다시 안 나온다 (출제 목록이 시작 시 `late final`로 고정되기 때문) — 의도된 동작
- [ ] ~~홈 화면 "오늘 N개" 진입점~~ — 홈은 고양이 이미지만 두기로 해서 보류 (진입점은 하단 탭의 테스트 화면)

> **작업 중 되돌린 것**: 한때 `lib/screens/review/` 아래에 복습 전용 화면을 새로 만들고 기존 `word_test_session_screen.dart`를 삭제했었으나, 좋아요·메모 시트 같은 기존 기능이 함께 사라져 전부 원복했다. 최종 방침은 **새 화면을 만들지 않고 기존 테스트 화면의 채점만 SM-2로 교체**하는 것.

---

## 모듈 5 — 검증 ⬜ 예정

- [ ] `flutter analyze` / `flutter test` 전체 통과 확인 (로컬 실행 필요)
- [ ] 채점 → `srs_due_at` 갱신 → 홈/테스트 화면에 반영되는지 앱 내에서 직접 확인

---

## 범위 밖 (v1에서 안 함)

- 웹 복습 UI — 사유는 [docs/SRS-PLAN.md](docs/SRS-PLAN.md) "향후 개선 검토" 참고
- Hard/Easy 4버튼, FSRS, `review_logs` 히스토리, 푸시 알림

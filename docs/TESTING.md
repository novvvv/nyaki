# 테스트

> 세 곳(서버·웹·앱)의 테스트를 한 번에 보는 문서. 무엇을 어디서 검증하는지와
> 돌리는 법만 적는다. 2026-09-23 정리.

## 돌리는 법

```bash
# 서버 — DB 없이 sqlite로 돈다. conftest가 없어 환경변수가 필요하다
cd api && DATABASE_URL=sqlite:////tmp/nyaki_test.db PYTHONPATH=. pytest

# 웹
cd web && npm test          # 한 번 / npm run test:watch

# 앱
flutter test
```

## 무엇을 어디서 보는가

SM-2는 **Dart와 Python 두 곳에 구현**돼 있다. 두 구현이 어긋나면 같은 단어의
다음 복습일이 기기마다 달라진다. 그래서 같은 입출력을 양쪽에서 각각 고정한다.

| 검증 대상 | 서버 | 앱 | 웹 |
|---|---|---|---|
| SM-2 기본 계산 | `test_srs.py` | `sm2_test.dart` | — (계산하지 않음) |
| 학습 단계 | `test_srs_steps.py` | `sm2_steps_test.dart` | `review.test.ts` (순서만) |
| 채점 API·멱등성 | `test_review.py` | — | `api-client.test.ts` |
| 하루 한도 | `test_daily_limits.py` | — | — |
| 부분 수정이 SRS를 지우지 않음 | `test_partial_update.py` | — | — |
| 동기화 push/pull | `test_sync.py` | — | — |
| 게이미피케이션 | `test_gamification.py` | `progress_repository_test.dart` | — |
| 저장소·outbox | — | `drift_vocab_repository_test.dart` | — |
| 모델 파생값(due·암기율) | — | `models/` | `stats.test.ts` |
| 열린 리디렉션 차단 | — | — | `safe-next.test.ts` |
| 공용 UI 계약 | — | `widget_test.dart` | `ui.test.tsx` |
| 복습 세션 흐름 | — | — | `app/review/page.test.tsx` |

## CI

GitHub Actions가 푸시·PR마다 세 곳을 전부 돌린다(`.github/workflows/ci.yml`).
배포(`deploy-api.yml`)는 서버 테스트를 `needs`로 걸어 **통과해야만** 진행된다.

서버 테스트는 CI에서 **Postgres로** 돌고 `alembic upgrade head`를 실제로 실행한다.
`downgrade -1 → upgrade`로 되돌릴 수 있는지도 본다.

> **왜 이렇게까지 하나** — 2026-09-24에 마이그레이션 백필 SQL의 콜론이 바인드
> 파라미터로 해석돼 컨테이너가 기동하지 못하고 운영이 8분간 내려갔다. 그때
> 테스트 69개는 전부 통과한 상태였다. 테스트는 `create_all`로 스키마를 만들어
> **마이그레이션 파일을 한 줄도 타지 않기 때문이다.** 배포도 초록불이었는데,
> 외부 헬스체크가 `API_HEALTH_URL` 시크릿이 없으면 건너뛰도록 돼 있었다.
> 지금은 서버 안에서 `localhost:8000/health`를 직접 확인하고, 안 뜨면 기동
> 로그를 출력하며 실패한다.

## 원칙

**계산을 먼저 덮는다.** 암기율·복습 간격·단계 진행처럼 틀려도 화면에는
그럴듯한 숫자가 뜨는 것들이다. 레이아웃은 눈으로 바로 보이지만 이건 안 보인다.

**경계를 검증한다.** 서버는 snake_case, 웹은 camelCase, 앱은 Drift 컬럼이다.
이 사이에서 필드를 하나 빠뜨리면 조용히 0이나 null이 흐른다 —
실제로 `srs_interval_days`가 매핑에서 빠져 암기율이 전부 0으로 나온 적이 있고,
`srs_learning_step`도 같은 자리에서 빠진 것을 이 테스트로 잡았다.

**순수 로직은 화면에서 떼어낸다.** `web/src/lib/review.ts`, `safe-next.ts`가
그래서 분리돼 있다. 컴포넌트 안에 있으면 렌더를 거쳐야만 검증할 수 있다.

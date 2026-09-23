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

## 원칙

**계산을 먼저 덮는다.** 암기율·복습 간격·단계 진행처럼 틀려도 화면에는
그럴듯한 숫자가 뜨는 것들이다. 레이아웃은 눈으로 바로 보이지만 이건 안 보인다.

**경계를 검증한다.** 서버는 snake_case, 웹은 camelCase, 앱은 Drift 컬럼이다.
이 사이에서 필드를 하나 빠뜨리면 조용히 0이나 null이 흐른다 —
실제로 `srs_interval_days`가 매핑에서 빠져 암기율이 전부 0으로 나온 적이 있고,
`srs_learning_step`도 같은 자리에서 빠진 것을 이 테스트로 잡았다.

**순수 로직은 화면에서 떼어낸다.** `web/src/lib/review.ts`, `safe-next.ts`가
그래서 분리돼 있다. 컴포넌트 안에 있으면 렌더를 거쳐야만 검증할 수 있다.

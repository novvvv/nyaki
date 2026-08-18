# 지금 당장 손댈 것 (코드 기준)

> 로컬 전용 출시 기준. 사용자 눈에 바로 보이는 구멍부터.
> 출시 전 전체 목록은 [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)

## 체크리스트 (2026-08-11 기준)

- [x] 웹 단어장 화면에 Bklit UI 링 차트 적용 + 미니멀 정리 (2026-08-11) — shadcn 레지스트리(`@bklit/ring-chart`) 소스를 `web/src/components/charts/`에 직접 배치(샌드박스가 shadcn CLI 다운로드를 막아서 JSON 수동 이식), 단어장 상세 상단에 암기율·즐겨찾기 링 차트(`word-book-stats.tsx`) 추가. 목록·상세·단어 폼 화면 여백·타이포·버튼 위계 정리(메인페이지는 제외). `next build`/`eslint` 통과 확인, **커밋은 아직 안 함**
- [ ] (진행 중, 2026-08-11) 단어 정보 입력 폼에 `isBookmarked` 토글 추가 — 상세는 아래 "### 5" 참고
- [ ] 단어 정보 입력 폼에 `tags` 추가 — 앱 전체에 태그 입력 UI가 아예 없음. 상세는 아래 "### 5" 참고
- [ ] `imagePath` 사진 선택 미연결 — `add_word_screen.dart`의 `_PhotoPicker`가 `onTap: () {}`로 비어있어 사진을 골라도 저장이 안 됨. 상세는 아래 "### 5" 참고
- [x] 단어장 수정·삭제 UI (2026-08-10) — `word_book_detail_screen.dart` 헤더에 ⋯ 메뉴(이름 수정/삭제) 연결, 커밋됨 (`1ed0763`)
- [x] (부분) build-time 크래시 화면 (2026-08-10, 커밋 `1ed0763`) — `core/error_screen.dart` 추가: 위젯 렌더링 중 예외 나면 기본 빨간 화면 대신 커스텀 화면(release에서만). 단, 아래 "에러 메시지 정리"와는 별개 문제 — 그건 아직 안 됨
- [ ] ~~홈 화면 고양이 상태 반응~~ → **게이미피케이션과 묶어서 후순위로 이동** (2026-08-10). 이유: "dueCount 보고 이미지만 바꾸기"로 좁게 잡아도, 실제로 손대기 시작하면 streak·보상·퀘스트 연동까지 자연스럽게 엮이는 주제라 반나절로 안 끝날 가능성 높음 → 아래 "지금 안 하는 것 · 게이미피케이션"에서 한 번에 설계하기로
- [x] 에러 메시지 정리 (2026-08-10, 커밋 `09cb2e8`) — `core/error_snackbar.dart` 공통 헬퍼로 10곳 전부 상황별 문구("저장에 실패했어요" 등)로 교체, 실제 에러는 콘솔에만 남김
- [x] (부수 작업, 2026-08-10, 커밋 `09cb2e8`) 단어장 목록·단어 추가·설정 화면 헤더 아래 장식용 부제목 문구 제거 (단어장 상세 화면의 사용자 입력 설명은 유지)
- [ ] 단어장 정보 탭 채우기 — "준비 중" 자리표시자 그대로. v1 구성은 아래 "### 4" 참고 (2026-08-10 업데이트: `learningRate` 대신 학습 단계 분포로 교체)
- [ ] (결정 필요) 로컬 전용 v1에서 로그인 진입점 유지할지 — 유지 시 Apple 계정 삭제 의무 걸림. 대안: 계정별 sync 허용 여부 서버에서 gating (아래 메모 참고)
- [x] (환경) 로컬 `flutter analyze`/`flutter test` 툴체인 복구 완료, 커밋됨 (`d852fa8`) — Dart SDK 캐시에 `dartdev.dart.snapshot` 누락돼있던 게 원인. `bin/cache` 삭제 후 `flutter upgrade`(3.27.3→3.44.9)로 재부트스트랩, `google_fonts`도 6.3.0→6.3.3으로 올려서 const-eval 컴파일 에러 해결
- [ ] `test/widget_test.dart` 이 지금 실패함 — **앱 버그 아니라 테스트가 낡음**. 홈 화면에 `assets/icon/quest.png` 퀘스트 버튼이 있고 탭하면 퀘스트 탭으로 간다고 기대하는데, 지금 `app_shell.dart`의 바텀바엔 퀘스트 탭 자체가 없음(Home/단어장/단어추가/테스트/설정 5개뿐). `QuestScreen`은 앱 어디서도 라우팅되지 않는 고아 코드. 테스트를 지금 UI에 맞게 고치거나(2번 "홈 화면 반응" 작업 때 같이), 퀘스트 진입점을 다시 넣을지 결정 필요
- [ ] `flutter analyze` deprecation 경고 1건 — `word_test_screen.dart:498`의 `activeColor` → `activeThumbColor`로 교체 (Flutter 버전 업 때문에 나온 경고, 사소함)

## 순서

### 1. 단어장 수정·삭제 UI (F-WB-02·03)

- `vocab_controller.dart`·repository 3종에 `updateWordBook`/`deleteWordBook`이 이미 구현돼 있음 → **화면에서 호출하는 곳이 없을 뿐**
- 같은 기능이 웹(`web/src/app/word-books/[id]/page.tsx`, 커밋 `3b0a767`)엔 붙어있어서 앱만 뒤처진 상태
- `word_book_detail_screen.dart` 헤더에 메뉴 버튼 → 이름 수정 / 삭제
- 로컬 앱에서 만든 단어장을 못 지우는 건 기능적 결함. 출시 전 필수

### 2. ~~홈 화면 — 고양이에 반응 붙이기~~ (2026-08-10: 게이미피케이션과 묶어서 후순위로 이동, 아래 "지금 안 하는 것" 참고)

지금 `home_screen.dart`는 `Image.asset('cat.png')` 한 장이 전부(22줄). 첫 화면이 아무 정보도 안 줘서 고양이가 의미 없어 보임.

- `assets/images/`에 이미 6장 있음 (`cat.png`, `nyangki_sleeping.png`, `default.png`, `default_2/3.png`, `2.png`) → **새 그림 없이 상태 변화 가능**
- `WordBook.dueCount` 그대로 사용:
  - 복습 남음 → 깨어있는 고양이 + "오늘 N개 남았어요"
  - 다 끝냄 → `nyangki_sleeping.png` + "오늘 다 했어요"
  - 탭 → 살짝 흔들리거나 포즈 전환
- 반나절 분량. 정적 이미지 → 반응하는 캐릭터로 바뀌는 게 앱 인상을 제일 크게 바꿈

### 3. 에러 메시지 정리

- 여러 화면에서 `SnackBar(content: Text(error.toString()))` → Dart 예외 문자열이 사용자에게 그대로 노출
- 공통 함수 하나 만들어 "저장에 실패했어요" 수준으로 교체

### 4. 단어장 정보 탭 채우기

현재 "준비 중" 자리표시자. (2026-08-10 업데이트) `learningRate`가 `srsRepetitions >= 2`로 켜지는 이진 플래그라서 방금 2번 맞춘 단어랑 반복 10번·간격 200일짜리 단어를 똑같이 "암기함"으로 셈 — 실제 정착도를 못 보여줌. SM-2 필드(`srsEaseFactor`/`srsIntervalDays`/`srsRepetitions`/`srsLapses`/`srsLastReviewedAt`)는 이미 다 있으니 스키마 변경 없이 정량화 가능.

**v1 구성 (스키마 변경 없음, `WordBook`/`Word`에 getter만 추가)**
1. 총 단어 수 (`wordCount`) · 오늘 복습할 개수 (`dueCount`) — 기존 그대로
2. **학습 단계 분포** — `learningRate` 퍼센트 하나 대신 4단계로:
   - 신규 (`repetitions == 0`)
   - 학습 중 (`repetitions` 1~2, `intervalDays < 7`)
   - 복습 중 (`intervalDays` 7~30일)
   - 장기 기억 (`intervalDays >= 30일`)
3. 즐겨찾기 개수 (`words.where((w) => w.isBookmarked).length`)
4. 마지막 학습일 (`words.map((w) => w.srsLastReviewedAt).nonNull` 중 최댓값)
5. 생성일 — 기존 그대로
6. **밀린 복습 개수** (`srsDueAt`이 오늘보다 7일 이상 지난 단어 수, 0이면 숨기거나 "밀린 것 없음")

**P2로 미룬 것** (재미있지만 v1엔 과함): 평균 ease factor, 자주 틀리는 단어 Top 3 (`srsLapses` 내림차순), 주간/월간 단어 추가 추이 그래프, 일평균 추가 속도.

### 5. 단어 정보 입력 폼 격차 (2026-08-11)

`Word` 모델·`CreateWordInput`/`UpdateWordInput`엔 `imagePath`/`tags`/`isBookmarked`가 이미 다 있고 repository 계층도 전부 받아줌. 문제는 화면에서 안 쓰거나 반쪽만 씀 — **스키마·repository 변경 없이 화면만 붙이면 되는 작업.**

- **`isBookmarked`** — 앱에 토글 자체는 있음(`word_test_session_screen.dart`의 하트 아이콘, `_toggleBookmark`). `word_book_detail_screen.dart`엔 북마크 필터 탭도 있지만 읽기 전용(필터링만, 토글 아님). 정작 `add_word_screen.dart`/`edit_word_screen.dart`(단어 추가·수정 폼)엔 없어서 단어 만들 때·수정할 때는 북마크를 못 건드림 — 테스트 화면에서만 가능. 웹(`word-form.tsx`)엔 체크박스로 이미 있음. → **하트 아이콘을 두 폼에 추가, `word_test_session_screen.dart`의 `Icons.favorite_rounded`/`Icons.favorite_border_rounded` + `NyakiColors.ink` 스타일 그대로 재사용.**
- **`tags`** — 앱 어디에도 UI가 전혀 없음(추가/수정 폼은 물론 단어 목록·상세 어디에도 표시/입력 없음). `CreateWordInput`에 tags를 안 넘기니 앱에서 만든 단어는 항상 빈 태그로 고정됨. 웹은 쉼표 구분 텍스트 입력으로 이미 있음(`word-form.tsx` 188-195행).
- **`imagePath`** — `add_word_screen.dart`의 `_PhotoPicker` UI는 있지만 `onTap: () {}`로 비어있어 사진 선택이 아예 안 됨. `edit_word_screen.dart`엔 이 UI조차 없음. 이미지 피커 패키지 연동 + 로컬 파일 저장 경로 정리가 필요해서 셋 중 제일 손이 감(파일 I/O·권한 처리 포함) → **후순위**.

**우선순위: `isBookmarked` → `tags` → `imagePath`.** 앞 둘은 폼에 위젯 하나 추가하고 기존 input 필드에 값만 연결하면 끝. `imagePath`는 이미지 피커 의존성 추가부터 시작해야 해서 별도 작업으로 분리.

---

## 지금 안 하는 것

**퀘스트·게이미피케이션 (`quest_screen.dart` + 홈 화면 고양이 반응)** — 원래 별개로 봤던 두 항목을 하나로 합침. 퀘스트는 정적 목록 117줄, 제대로 하려면 진행도 추적·일일 리셋·보상 저장까지 필요. 홈 화면 고양이 반응도 좁게 잡아도 결국 이 시스템(streak·보상)과 엮이게 됨. 나중에 한 번에 설계 — 진행도 추적, 일일 리셋, 캣닢 보상, streak, 홈 화면 고양이 상태까지 묶어서. 1~2주짜리. 출시를 미룰 가치 없음.

**로컬 전용 출시면 P0 절반이 사라짐** — HTTPS·도메인 불필요(서버 안 씀), 개인정보처리방침도 단순해짐. 단, 로그인 화면이 존재하는 것만으로 Apple 계정 삭제 의무가 걸리므로 v1에서 진입점을 막을지 결정 필요.

---

## 메모 — 계정별 sync 등급(allowlist) (2026-08-10)

로그인 UI/Hub 서버 코드는 그대로 두고, **특정 계정(본인 테스트 계정)만 실제로 클라우드 sync가 동작**하게 하는 방식. 나머지 계정은 로그인해도 자동으로 로컬 전용처럼 동작 — 로그인 진입점을 아예 막을지 고민하는 대신 쓸 수 있는 제3의 선택지.

- 지금 Hub엔 User 테이블 자체가 없음 ([api/app/models.py](api/app/models.py)) — `user_id`(Firebase UID)가 `word_books`/`words`에 컬럼으로만 존재. 등급/플랜 필드 없음.
- **서버 쪽에서 막아야 실효성 있음** (클라이언트 판단은 우회 가능). `api/app/auth.py`의 `get_current_user_id`에 이메일 allowlist 체크하는 `require_sync_access` 의존성 추가 → `/v1/sync/push`·`/v1/sync/pull`에만 적용. `api/.env`에 `SYNC_ALLOWED_EMAILS=...` 추가하면 끝, DB 마이그레이션 불필요.
- 403 받으면 [sync_coordinator.dart](lib/data/sync/sync_coordinator.dart)의 `catch (_) {}`가 삼키고 재시도만 반복 → outbox가 무한히 쌓이는 부작용 있음. 제대로 하려면 403 시 클라이언트가 타이머를 멈추는 로직 추가 필요.
- 나중에 진짜 요금제(쿼터) 붙일 때 이 allowlist를 `role` 컬럼으로 자연스럽게 확장 가능 — 일회성 땜빵이 아니라 향후 플랜 시스템의 시작점이 될 수 있음.

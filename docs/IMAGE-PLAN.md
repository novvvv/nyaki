# 단어 사진 첨부 — 설계 · 실행 계획

> 2026-08-16 논의 정리. 단어에 사진을 붙이는 기능을 **어디에 저장하고 어떻게 동기화할지**에 대한 결론과 단계별 계획.
> 관련: [DOMAIN.md](DOMAIN.md) · [app_erd.md](app_erd.md) · [api/DEPLOY.md](../api/DEPLOY.md) · [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)

---

## 현재 상태

배관은 이미 다 뚫려 있다. **UI와 저장소만 없다.**

**있는 것**

| 위치 | 내용 |
|------|------|
| `lib/models/word.dart` | `imagePath` 필드 |
| `lib/data/local/tables.dart` | `WordEntries.imagePath` 컬럼 |
| `lib/data/repositories/vocab_repository.dart` | `CreateWordInput` · `UpdateWordInput`의 `imagePath` |
| `drift_vocab_repository.dart` · `in_memory_vocab_repository.dart` | 양쪽 다 처리 |
| `lib/data/sync/sync_coordinator.dart` | `image_path` 직렬화 · 역직렬화 |
| `api/app/models.py` | `WordModel.image_path` (nullable Text) |
| `web/src/lib/api-client.ts` | `image_path` 타입 정의 |
| `word_test_session_screen.dart` | `_WordImage` — `assets/` 접두사 분기 |

**없는 것**

- 사진 선택 UI — `add_word_screen` · `edit_word_screen` · `word_form_field` 어디에도 없음
- `image_picker` 의존성, iOS/Android 권한 설정
- 저장소 — 업로드 엔드포인트도, 파일 복사 로직도 없음
- 웹 업로드 UI — `api-client.ts:141`은 단어 생성 시 `image_path: null`을 하드코딩
- 목록 · 상세 화면 썸네일 (`word_book_detail_screen`에 이미지 표시 전무)

지금 앱에 보이는 유일한 사진은 시드 데이터의 `assets/images/nyangki_sleeping.png` (하드코딩).

---

## 결정 — 자체 서버(Hub) 저장

Firebase Storage와 비교해 **Hub 쪽으로 정한다.**

**이유**

1. **데이터 일원화** — 단어 데이터가 이미 자체 Postgres에 있다. 사진만 Firebase로 가면 백업 · 계정삭제 · 이전 시나리오가 두 벌이 된다. 현재 Firebase는 인증만 담당하는 선이 그어져 있고, 그 선을 유지한다
2. **계정 삭제** ([RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) P0) — Postgres row 삭제하면서 파일 같이 정리하면 끝
3. **개인정보처리방침** — "자사 서버 저장" 한 줄. 국외 이전 고지 불필요
4. **비용 예측 가능** — Lightsail 플랜에 포함되어 추가 비용 0. Firebase Blaze는 무료 한도가 크지만 **지출 상한이 없다** (버그·트래픽 급증 시 청구서 무한)

**포기하는 것**: CDN, 자동 리사이징, 업로드 재시도 인프라. 직접 구현하거나 없이 간다.

**재검토 조건**: 사용자·트래픽이 커져 단일 서버의 디스크 또는 대역폭이 부담되면 S3 이전 검토. `image_path`가 URL 문자열이라 이전 비용은 낮다.

---

## 스키마

**문제**: `image_path` 한 컬럼이 세 가지 의미(에셋 경로 / 로컬 파일 / 원격 URL)를 겸하면 앱·웹 분기 규칙이 어긋나기 시작한다. 분리한다.

| 컬럼 | 동기화 | 용도 |
|------|:---:|------|
| `image_path` | ✅ | 원격 URL (또는 시드 에셋 경로). **정본** |
| `image_local_path` | ❌ 로컬 전용 | 촬영 원본 / 다운로드 캐시 |
| `image_upload_pending` | ❌ 로컬 전용 | 업로드 대기 플래그 |

**표시 규칙** (앱 · 웹 공통)

1. `image_local_path` 있으면 그것 (`Image.file`)
2. 없고 `image_path`가 `assets/`로 시작하면 에셋 (`Image.asset`)
3. 그 외 `image_path`는 네트워크 URL (`Image.network`)

**마이그레이션**

- **Drift**: v4 → v5, `addColumn` 2개. 기존 row는 null이라 영향 없음
- **Hub**: 없음 — `image_path`가 이미 nullable Text
- **웹**: 없음

---

## 업로드 흐름

```
사진 선택
  → 압축 (1024px · quality 85 → 200KB 내외)
  → 앱 디렉터리로 복사, image_local_path 기록, pending = true
  → 화면에 즉시 표시              ← 오프라인에서도 여기까지 동작
        ↓ (네트워크 가능 시)
  → POST /v1/media 업로드
  → 응답 URL을 image_path에 기록, pending 해제
  → outbox에 upsert → 기존 sync 경로로 Hub 반영
        ↓
  웹 · 다른 기기는 image_path URL로 조회
```

**핵심**: 업로드는 `sync_coordinator`와 **별도 경로**로 돈다. sync에는 URL 문자열만 흘러가므로 기존 JSON 기반 outbox 구조를 건드리지 않는다.

압축은 선택이 아니라 필수다. 요즘 폰 사진은 3~5MB이고, 안 하면 업로드 시간과 대역폭이 다 터진다.

---

## 보안 요구사항

Caddy 정적 서빙에는 **인증이 없다.** 가장 현실적인 사고는 해킹이 아니라 **URL 추측**이다.

1. **파일명은 랜덤 UUID** — 단어 ID·순번 절대 금지. 122비트 난수면 추측 불가 (capability URL 모델)
2. **업로드 검증** — magic byte로 실제 이미지인지 확인(확장자 불신), 용량 상한(예: 5MB), **사용자가 보낸 파일명은 그대로 쓰지 않기** (path traversal)
3. **소유권 확인** — 대상 단어가 요청자 uid의 것인지 검사. `get_current_user_id` 재사용
4. **응답 헤더** — Content-Type 화이트리스트 + `X-Content-Type-Options: nosniff`
5. **디렉터리 브라우징 off** — Caddy `file_server` 기본값이라 그대로 두면 됨
6. **서버 재인코딩** — 업로드 원본을 그대로 저장하지 않고 Pillow로 디코딩 → 재저장. 폴리글랏 파일(이미지처럼 보이는 악성 페이로드) 무력화 + **EXIF 제거로 GPS 위치정보 유출 방지**. 이미 Pillow를 쓰므로 압축 단계에 얹으면 추가 비용 거의 없음

더 강한 보장이 필요하면 정적 서빙 대신 FastAPI가 토큰 검사 후 스트리밍하는 방식으로 전환. 성능이 대가.

> 참고: Firebase를 골랐어도 안전한 건 아니다. Storage Rules를 `allow read: if true`로 열어두는 게 업계 최다 유출 사고다. 양쪽 다 **설정 실수가 유일한 현실적 위험**.

---

## 비용

| 항목 | 값 |
|------|-----|
| Lightsail $5 플랜 | 40GB SSD · 월 2TB 전송 (이미 지불 중) |
| 예상 사용량 | 압축 200KB × 단어 1만 개 ≈ **2GB** |
| 추가 비용 | **0원** |

디스크 사용량 모니터링과 볼륨 백업은 별도 과제. 현재 `api/docker-compose.yml`에 `postgres_data` 볼륨만 있고 백업 설정이 없다.

---

## 단계

### 1단계 — 앱 로컬 사진 (반나절)

**목표: 서버 없이 사용자가 바로 쓸 수 있는 상태로 먼저 배포**

- `pubspec.yaml`: `image_picker` 추가
- **iOS `Info.plist`**: `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` — 현재 usage description이 **하나도 없음**. App Store 심사 단골 반려 항목
- Android 권한 확인
- Drift v4 → v5 마이그레이션 + `build_runner` 재생성
- 이미지 저장 유틸: 압축 → 앱 디렉터리 복사 → 경로 반환
- 폼 위젯 (add / edit 공용) — 썸네일 + 추가·변경
- 상세 · 목록 화면 썸네일 표시

컬럼을 **처음부터 최종안대로** 잡으므로 이후 단계에서 재작업이 없다.

### 2단계 — 서버 업로드 (1일)

- `requirements.txt`: `python-multipart`, `Pillow` 추가 (**현재 둘 다 없음** — multipart는 FastAPI 파일 업로드 필수)
- `POST /v1/media` — 인증 · 검증 · **재인코딩(EXIF 제거)** · UUID 저장 · URL 반환
- 단어 삭제 시 파일 정리
- Caddy: `/media` file_server 라우트
- docker-compose: media 볼륨 추가
- `api/tests/test_media.py`

Alembic 마이그레이션 불필요. 인증 · HTTPS · CI/CD가 이미 돌고 있어 붙이기 쉽다.

### 3단계 — 앱 업로드 큐 (1일)

- pending 스캔 → 업로드 → `image_path` 갱신 → outbox
- 실패 재시도 · 오프라인 대기
- 네트워크 URL 표시 분기 (`_WordImage`에 추가)

**가장 버그 나기 쉬운 구간.**

### 4단계 — 웹 (반나절)

- `word-form.tsx` 업로드 UI
- `api-client.ts:141`의 `image_path: null` 하드코딩 제거
- 표시

### 5단계 — 마무리 (반나절)

- 디스크 모니터링 · 백업
- QA

**합계: 4~6일 (풀타임) / 2주 안팎 (파트타임)**

---

## 선결 과제

**`UpdateWordInput`의 null 의미 문제.**

현재 `imagePath == null`이 "변경 없음"으로 해석된다 (`drift_vocab_repository.dart:278`, in-memory도 동일). 이 구조로는 **사진 삭제를 표현할 수 없다.**

- 삭제 기능을 1단계에서 빼면 회피 가능
- 넣으려면 sentinel 값 또는 `Value<String?>` 래퍼로 전환 — repository 2개와 호출부 전체 수정

다른 nullable 필드(`pronunciation`, `description`, `example`)도 같은 문제를 안고 있으므로 **어차피 언젠가는 고쳐야 한다.**

---

## 리스크

| 리스크 | 대응 |
|--------|------|
| `build_runner` 재생성 실패 | 8/10 Flutter 3.44 업그레이드 이력 있음 (`d852fa8`). 툴체인 먼저 확인 |
| iOS 심사 반려 (권한 문구) | 사용 목적을 구체적으로 기술 |
| 업로드 큐 무한 재시도 | 재시도 상한 · 백오프 |
| 디스크 포화 | 모니터링 + 사용자당 쿼터 검토 |
| 고아 파일 누적 | 단어 삭제 시 정리 + 주기적 정합성 점검 |

---

## 미결정

- **사진 삭제 기능을 1단계에 포함할지** (위 선결 과제)
- **사용자당 사진 개수 · 용량 쿼터** — Pro 플랜 차별화 요소가 될 수 있음 (`notes/product/pricing-v0.2.md` 참고)
- **단어당 사진 1장 고정 vs 복수 허용** — 현재 스키마는 1장 전제

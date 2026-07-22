# Nyaki

모바일과 웹에서 같은 단어장을 이어서 학습하는 미니멀 단어장.

Flutter 앱, Next.js 웹, FastAPI Sync Hub 세 클라이언트가 한 계정의 데이터를 공유하는 모노레포다.

## 동작 방식

- **앱**: 오프라인 우선. 로컬 DB(Drift)에 먼저 쓰고, 로그인 시 Hub와 동기화(push/pull).
- **웹**: Hub를 직접 CRUD. 서버가 원본.
- **인증**: Firebase 토큰으로 요청 → 서버가 사용자별로 데이터 격리.
- **동기화**: soft delete, 충돌 시 `updated_at` 최신 우선.

## 구조

```
nyaki/
├── lib/     Flutter 앱
├── web/     Next.js 웹
├── api/     Sync Hub (FastAPI + Postgres)
├── docs/    공개 명세 (API · 도메인)
└── notes/   개인 메모 (git 제외)
```

### lib/ — 앱

```
main.dart      진입 · 초기화
core/          상태 주입 · 테마
models/        WordBook, Word
data/          local(Drift) · repositories · auth · sync
screens/       홈 · 퀘스트 · 단어장 · 추가 · 테스트 · 설정
widgets/       공통 UI
```

화면 → `VocabController` → Drift. 변경은 outbox에 쌓이고 `SyncCoordinator`가 Hub와 맞춘다.

### web/ — 웹

```
app/         페이지 (목록 · 상세 · 단어 CRUD)
components/  로그인 게이트 · 셸
lib/         api-client · 상태 · firebase
```

### api/ — Sync Hub

```
main.py      앱 · /health
auth.py      Firebase 토큰 → user id
routes.py    /v1 CRUD + /v1/sync/*
services.py  upsert · soft delete · 변경 로그
models.py    word_books · words · sync_changes
```

웹용 REST CRUD와 앱용 `sync/push`·`sync/pull` 제공. 변경마다 커서를 늘리고, 앱은 마지막 커서 이후만 받아간다.

## 문서

- 도메인: [docs/DOMAIN.md](docs/DOMAIN.md)
- API: [docs/API.md](docs/API.md)
- 실행 · 배포: [api/README.md](api/README.md)

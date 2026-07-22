# notes/ — 개인용 메모 (git 제외)

이 폴더는 **로컬에서만** 본다. `notes/README.md` 만 저장소에 포함되고, 아래 하위 폴더는 `.gitignore` 된다.

## 폴더

| 경로 | 내용 |
|------|------|
| `product/` | 제품 방향·비전 (구 PRODUCT_DIRECTION) |
| `requirements/` | 기능 요구사항·체크리스트 |
| `architecture/` | 전체 구조·데이터 흐름 |
| `backend/` | Hub API · DB · 배포 메모 |
| `sync/` | 동기화·백업 설계 |
| `dev/` | 설치·디버그 (예: iOS 설치) |

## 버전 규칙

1. 파일명: `v0.1.md`, `v0.2.md` … (날짜를 쓰면 `v2026-07-22.md` 도 OK)
2. 최신본은 같은 폴더의 **가장 높은 버전** (또는 `CURRENT.md`를 복사본으로 유지)
3. 크게 바뀌면 **복사 후** 새 버전에서 수정 — 이전 버전은 그대로 둔다

```bash
cp notes/requirements/v0.1.md notes/requirements/v0.2.md
# v0.2.md 편집
```

## 공개 문서와의 차이

- 공개 → `docs/`, 루트 `README.md`, `api/README.md`
- 비공개 → 여기 `notes/`

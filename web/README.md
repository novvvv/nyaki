# Nyaki Web

Next.js 단어장 편집 UI (Firestore·Drive 연동 전).

## 실행

```bash
cd web
npm install
npm run dev
```

http://localhost:3000

## 범위

- 단어장 목록 / 상세 / 단어 추가·수정·삭제 UI
- Nyaki 앱과 동일 cream/ink 톤
- 클라이언트 메모리 목업 (`VocabProvider`) — 새로고침 시 초기 시드로 리셋

## 이후

- Firebase Auth 로그인
- Firestore CRUD (저장 시 1 write)
- Flutter 앱과 동일 스키마·경로

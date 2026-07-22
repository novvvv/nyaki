# Nyaki Sync Hub

FastAPI + Postgres 기반의 단어장 Sync Hub입니다.

API 계약(포트폴리오용): [docs/API.md](../docs/API.md)

## 로컬 실행

```bash
cd api
cp .env.example .env
# DATABASE_URL, POSTGRES_PASSWORD, FIREBASE_PROJECT_ID를 채운다.
docker compose up --build
```

API health check: `http://localhost:8000/health`  
OpenAPI: `http://localhost:8000/docs`

## 인증

모든 `/v1/*` 요청은 Firebase ID token을 요구합니다.

```http
Authorization: Bearer <Firebase ID token>
```

FastAPI 컨테이너에는 Firebase Admin 서비스 계정 JSON을 환경 변수
`GOOGLE_APPLICATION_CREDENTIALS` 경로로 제공해야 합니다.

## 증분 sync

- `POST /v1/sync/push`: Drift outbox 변경을 최대 100건씩 전송
- `GET /v1/sync/pull?cursor=123`: cursor 이후 변경분만 수신

서버는 `(Firebase UID, entity ID)`를 복합 키로 사용하고 `updated_at`이 더 최신인
변경만 반영합니다. 삭제는 tombstone(`is_deleted`)으로 유지합니다.

## Lightsail 배포

1. `api/`를 Lightsail에 배포한다.
2. Firebase Admin 서비스 계정 JSON을 서버 전용 경로에 저장한다.
3. 서버의 `.env`에 다음을 설정한다.

```dotenv
POSTGRES_PASSWORD=...
DATABASE_URL=postgresql+psycopg://nyaki:...@db:5432/nyaki
FIREBASE_PROJECT_ID=...
CORS_ORIGINS=https://<웹-도메인>
FIREBASE_SERVICE_ACCOUNT_PATH=/opt/nyaki/secrets/firebase-admin.json
CADDY_SITE_ADDRESS=api.<도메인>
```

4. DNS에서 `api.<도메인>` A 레코드를 Lightsail 공인 IP로 연결한다.
5. 실행한다.

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
curl https://api.<도메인>/health
```

Firebase Console에서는 웹 도메인을 Authorized domains에 추가하고, `web/.env.local`의
`NEXT_PUBLIC_API_BASE_URL=https://api.<도메인>` 및 Firebase Web 환경 변수를 설정한다.

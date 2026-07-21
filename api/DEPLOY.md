# Nyaki 배포 체크리스트

> 로컬 Docker 불가 시 → **Lightsail 직행** (아래 1번부터)

---

## 1. Lightsail 인스턴스 만들기

- AWS Lightsail → **Ubuntu 22.04**, $5~10 플랜
- **Static IP** 연결 (재부팅해도 IP 고정)
- 방화벽: **22, 80, 443** 열기
- SSH 키 다운로드

---

## 2. 도메인 (HTTPS 필수)

Caddy가 자동 HTTPS를 쓰므로 **도메인 1개** 필요:

```
api.<도메인>  →  Lightsail Static IP  (A 레코드)
```

도메인 없으면: Lightsail DNS zone 쓰거나, 가비아/Cloudflare 등에서 서브도메인만 연결.

---

## 3. Mac → 서버 업로드

```bash
# SSH 테스트
ssh ubuntu@<STATIC-IP>

# 서버 폴더
ssh ubuntu@<IP> "sudo mkdir -p /opt/nyaki/secrets && sudo chown -R ubuntu:ubuntu /opt/nyaki"

# api 코드 + secrets (로컬 api/.env 는 올리지 말 것)
scp -r ~/Desktop/nyaki/api ubuntu@<IP>:/opt/nyaki/
scp ~/Desktop/nyaki/api/secrets/firebase-admin.json ubuntu@<IP>:/opt/nyaki/secrets/
```

---

## 4. 서버에서 Docker 설치 (최초 1회)

```bash
ssh ubuntu@<IP>

sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
# 로그아웃 후 재접속
```

---

## 5. 서버 `.env` 작성

```bash
nano /opt/nyaki/api/.env
```

```dotenv
POSTGRES_PASSWORD=서버용-강한-비밀번호
DATABASE_URL=postgresql+psycopg://nyaki:서버용-강한-비밀번호@db:5432/nyaki
FIREBASE_PROJECT_ID=nyaki-b129f
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-service-account.json
CORS_ORIGINS=https://<웹-도메인>,http://localhost:3000
FIREBASE_SERVICE_ACCOUNT_PATH=/opt/nyaki/secrets/firebase-admin.json
CADDY_SITE_ADDRESS=api.<도메인>
```

비밀번호에 `@` 넣지 말 것.

---

## 6. 배포 실행

```bash
cd /opt/nyaki/api
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose logs -f   # Uvicorn + Caddy 확인
curl https://api.<도메인>/health
```

---

## 7. 웹·앱 연결

**`web/.env.local`** (또는 Vercel env):

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://api.<도메인>
# Firebase 키들...
```

**Firebase Console** → Authorized domains → 웹 도메인 추가

**Flutter:**

```bash
flutter run --dart-define=NYAKI_API_BASE_URL=https://api.<도메인>
```

---

## 8. 검증

- [ ] `https://api.<도메인>/health`
- [ ] 웹 로그인 → 단어장/단어 CRUD
- [ ] 앱 같은 Google 계정 → sync

---

## (선택) 로컬 테스트

Mac Docker + 디스크 여유 있을 때만. 생략 가능.

```bash
cd api && docker compose up --build
curl http://localhost:8000/health
```

---

## 트러블슈팅

| 증상 | 확인 |
|------|------|
| HTTPS 안 됨 | DNS A 레코드, 443 방화벽, `CADDY_SITE_ADDRESS` |
| 401 | Firebase Admin JSON 경로, `FIREBASE_PROJECT_ID` |
| CORS | `CORS_ORIGINS`에 웹 origin 정확히 |
| DB 연결 실패 | `POSTGRES_PASSWORD` ↔ `DATABASE_URL` 일치 |

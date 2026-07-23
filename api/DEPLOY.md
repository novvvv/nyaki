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

## 9. GitHub Actions CD (자동 배포)

`main`에 `api/**`가 push되면 Actions가 Lightsail의 **api 컨테이너만** 다시 빌드·기동합니다.  
(db·caddy는 그대로. `.env`·`secrets/`는 서버 값을 유지합니다.)

### 9-1. 배포 전용 SSH 키

로컬에서:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/nyaki_deploy -N "" -C "nyaki-github-actions"
```

Lightsail에 공개키 등록:

```bash
# 서버에서 (ubuntu 유저)
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo '여기에 nyaki_deploy.pub 한 줄' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

로컬에서 접속 테스트:

```bash
ssh -i ~/.ssh/nyaki_deploy ubuntu@<STATIC-IP>
```

### 9-2. GitHub Secrets

저장소 → **Settings** → **Secrets and variables** → **Actions** → New secret:

| Name | Value |
|------|--------|
| `AWS_HOST` | Static IP 또는 도메인 |
| `AWS_USER` | `ubuntu` |
| `AWS_SSH_KEY` | Lightsail `.pem` **private** 키 전체 |
| `API_HEALTH_URL` | (선택) `https://api.<도메인>/health` |

### 9-3. 동작 확인

1. 워크플로 파일 commit & push (또는 Actions → **Deploy API** → Run workflow)
2. Actions 탭에서 초록불 확인
3. `curl https://api.<도메인>/health`

관련 파일: `.github/workflows/deploy-api.yml`  
연습용(서버 미연결): `.github/workflows/hello.yml`

---

## 트러블슈팅

| 증상 | 확인 |
|------|------|
| HTTPS 안 됨 | DNS A 레코드, 443 방화벽, `CADDY_SITE_ADDRESS` |
| 401 | Firebase Admin JSON 경로, `FIREBASE_PROJECT_ID` |
| CORS | `CORS_ORIGINS`에 웹 origin 정확히 |
| DB 연결 실패 | `POSTGRES_PASSWORD` ↔ `DATABASE_URL` 일치 |
| Actions SSH 실패 | Secrets 키 전체 붙여넣기, 서버 `authorized_keys`, 방화벽 22 |
| 배포 후 .env 없음 | rsync가 `.env`는 제외함 — 서버에 최초 1회 수동 작성 |

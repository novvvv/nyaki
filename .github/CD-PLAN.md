# Nyaki GitHub Actions · CD 플랜

이 폴더는 CI/CD 워크플로와 **배포 학습·운영 계획**을 둡니다.  
(제품/도메인 문서는 `docs/`, 수동 Lightsail 체크리스트는 `api/DEPLOY.md`.)

---

## 1. 목표

| 목표 | 내용 |
|------|------|
| CD | `main`에 `api/**` push 시 Lightsail API 자동 배포 |
| 범위 | **api 컨테이너만** 교체 (db·caddy는 유지) |
| 다운타임 | recreate — 짧은 끊김 허용 (무중단은 이후 과제) |
| 비목표(지금) | GHCR 이미지 레지스트리, Blue-Green, AWS Access Key |

웹(Vercel)은 별도 CD. 이 플랜은 **Lightsail FastAPI**만 다룹니다.

---

## 2. 아키텍처 (현재 CD)

```text
git push (main, api/**)
        │
        ▼
GitHub Actions (deploy-api.yml)
  1) checkout
  2) rsync api/ → ubuntu@Lightsail:/opt/nyaki/api/
       · .env / secrets/ 제외 (서버 값 유지)
  3) SSH → docker compose ... up -d --build api
  4) (선택) curl API_HEALTH_URL
        │
        ▼
Lightsail VM
  ├── caddy   (HTTPS 프록시, 매 배포 안 건드림)
  ├── api     ← 여기만 재빌드·재기동
  └── db      (Postgres 데이터 유지)
```

**Caddy** = 인스턴스 안 Docker 컨테이너. 도메인·HTTPS·`api:8000` 전달.  
Nginx와 역할은 같고, 자동 HTTPS가 단순해서 사용 중.

---

## 3. 워크플로 파일

| 파일 | 역할 | 서버 접근 |
|------|------|-----------|
| `workflows/hello.yml` | Actions 동작 확인 (`echo hello`) | 없음 |
| `workflows/deploy-api.yml` | API CD | SSH + rsync |

트리거 (`deploy-api`):

- `push` → `main` + paths `api/**` 또는 이 워크플로 파일
- `workflow_dispatch` → Actions 탭에서 수동 실행 (추천: Secrets 직후 첫 검증)

---

## 4. Secrets (깃에 넣지 말 것)

GitHub → Settings → Secrets and variables → Actions

| Name | 필수 | 설명 |
|------|------|------|
| `AWS_HOST` | ✅ | Static IP 또는 SSH용 호스트 |
| `AWS_USER` | ✅ | 보통 `ubuntu` |
| `AWS_SSH_KEY` | ✅ | Lightsail `.pem` **private** 키 전체 |
| `API_HEALTH_URL` | 선택 | 예: `https://api.<도메인>/health` |

### 하지 않는 것

- 깃 저장소에 AWS 콘솔 비밀번호 / Access Key 커밋
- `.env`, Firebase JSON을 Actions 로그에 출력
- CD에 AWS API 키 (이번 방식은 **SSH만** 사용)

서버 DB 비밀번호·Firebase 경로는 **Lightsail `/opt/nyaki/api/.env`** 에만 둡니다.

---

## 5. 학습·도입 단계 (플랜)

### Phase 0 — 전제
- [x] Lightsail에 compose로 api + db + caddy 수동 기동
- [x] `api/DEPLOY.md` 수동 배포 절차

### Phase 1 — Hello (서버 무관)
- [ ] `hello.yml` push 또는 Run workflow
- [ ] Actions 탭 초록불 + 로그에 `hello`
- **의미:** push → Actions 실행 파이프만 확인. 서버 hello 아님.

### Phase 2 — 배포 열쇠
- [ ] `ssh-keygen`으로 배포 전용 키 생성
- [ ] 공개키 → 서버 `~/.ssh/authorized_keys`
- [ ] 로컬에서 `ssh -i ...` 접속 성공
- [ ] GitHub Secrets 3개(+ 선택 health) 등록

### Phase 3 — CD 가동
- [ ] `deploy-api.yml`이 `main`에 있음
- [ ] Actions → Deploy API → Run workflow 성공
- [ ] `/health` 200, db 데이터 유지
- [ ] 이후 `api/**` push로 자동 배포 체감

### Phase 4 — (나중) CI 보강
- [ ] deploy 전에 lint / pytest job
- [ ] 실패 시 배포 job 스킵 → 이름 그대로 CI/CD

### Phase 5 — (나중) 이미지 기반 CD
- [ ] Actions에서 `docker build` → GHCR push
- [ ] 서버는 `pull` + `up` (서버 빌드 부담 감소)
- [ ] 태그는 커밋 SHA, 롤백 = 이전 태그

### Phase 6 — (더 나중) 무중단
- [ ] 단일 호스트 Blue-Green (api blue/green + Caddy 전환)
- [ ] 또는 복제본 롤링
- **지금 단계에서는 하지 않음**

---

## 6. 왜 api만 배포하나

| 서비스 | 매 CD | 이유 |
|--------|-------|------|
| api | ✅ | 애플리케이션 코드가 바뀜 |
| db | ❌ | 재생성 시 데이터 위험, 이미지도 거의 안 바뀜 |
| caddy | ❌ | Caddyfile/도메인 변경 시에만 수동 |

---

## 7. 운영 시 주의

- 서버 경로 전제: `/opt/nyaki/api` (`DEPLOY.md`와 동일)
- `docker compose down -v` 금지 (볼륨 삭제)
- 동시 배포 방지: `concurrency.group: deploy-api-production`
- 웹만 수정 시 API 워크플로는 paths 필터로 스킵

---

## 8. 관련 문서

| 위치 | 내용 |
|------|------|
| 이 파일 | CD 전체 플랜 (여기) |
| `workflows/*.yml` | 실제 자동화 |
| `api/DEPLOY.md` | Lightsail 최초 구축 + Secrets 상세 명령 |
| `api/Dockerfile` | api 이미지 정의 |
| `api/docker-compose*.yml` | api / db / caddy 구성 |

---

## 9. 한 줄 요약

**SSH 키만 Actions Secrets에 두고, api 코드 rsync 후 compose로 api만 재기동한다.  
AWS 비밀번호는 깃에도 Secrets에도 넣지 않는다. 무중단·GHCR은 이후 Phase.**

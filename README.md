**치안 안전 지도 (Backend)**

공공데이터로는 알 수 없는 체감 안전도를, 실시간 제보와 평가로 채운 치안 정보 지도 서비스 입니다.

[Web 버전 페이지 링크](https://github.com/Choi-JB/public_safety_map_web)
[App 버전 페이지 링크](https://github.com/Choi-JB/public_safety_map_app)

---

**개요 Description**

이 프로젝트는 치안 안전 지도의 **백엔드 API 서버**입니다.  
웹·앱 클라이언트가 공통으로 사용하는 REST API를 제공하며, MariaDB에 격자·인프라·제보·피드백 등을 저장·조회합니다.

주요 역할은 다음과 같습니다.

- 일반 유저: JWT 기반 인증, 제보·피드백·마이페이지, 이미지 업로드(마스킹)
- 관리자: 세션 기반 인증, 제보/피드백/도시행사 관리, 대시보드
- 지도 데이터: 격자·인프라 조회, 앱 오프라인 캐시용 sync(버전·페이지네이션)
- 알림: 제보 등록 시 Firebase Cloud Messaging(FCM) 푸시
- 외부 연동: 도로교통공단 사고다발구역 OpenAPI 프록시
- 배치: 매일 자정(KST) 격자 안전등급 재산출 (`node-cron`)

---

**DEMO**

[데모 버전 링크](https://43-202-197-59.nip.io/health)


자세한건 api 명세서 참조
---

**실행 방법 Getting Started**

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
#    .env.example을 복사해 .env 생성 후 값 채우기
#    - DATABASE_URL, JWT_SECRET, SESSION_SECRET (필수) (아래 생성방법 참조)
#    - FIREBASE_* (FCM 알림)
#    - KOROAD_AUTH_KEY (사고다발구역, 선택)


# 3. Prisma Client 생성
npx prisma generate

# 4. (선택) 안전등급 배치 1회 실행
npx ts-node --transpile-only src/jobs/runScore.ts

# 5. (최초 1회) 이미지 마스킹용 Python venv
cd masking
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..

# 6. 개발 서버 실행
npm run dev

# 7. DB 연결 확인
#    http://localhost:{PORT}/health/db
```

### JWT_SECRET / SESSION_SECRET 생성

유출이 의심되거나 최초 설정할 때, 아래 명령을 **두 번** 실행해 나온 값을 각각 `.env`에 넣습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**교체 시**

- `SESSION_SECRET` 변경 → 관리자 세션 전부 무효 → 재로그인 필요
- `JWT_SECRET` 변경 → access token 전부 무효 (유효한 refresh가 있으면 `/auth/refresh`로 복구 가능)

---

**기술 스택 Stack**

- **Runtime / Language:** Node.js, TypeScript
- **Framework:** Express
- **ORM / DB:** Prisma, MariaDB
- **Auth:** JWT (`jsonwebtoken`) + Refresh Token, express-session (관리자), bcrypt
- **Push:** Firebase Admin SDK (FCM)
- **Upload:** multer, Python 이미지 마스킹
- **Batch:** node-cron (안전등급 일일 배치)
- **External API:** 도로교통공단 사고다발구역 OpenAPI
- **Deploy:** Docker / Docker Compose

---

**프로젝트 구조 Project Structure**

```text
backend/
|-- docs/                         # 설계·명세 문서
|-- masking/                      # 이미지 마스킹 (Python)
|   |-- mask_cli.py
|   |-- masking.py
|   `-- requirements.txt
|-- prisma/
|   `-- schema.prisma             # DB 스키마
|-- src/
|   |-- config/
|   |   |-- env.ts                # 필수 환경변수 검증
|   |   |-- firebase.ts           # Firebase Admin (FCM)
|   |   |-- koroad.ts             # 사고다발구역 API 상수
|   |   `-- prismaClient.ts       # PrismaClient 싱글톤
|   |-- controllers/
|   |   |-- accidentZone.controller.ts
|   |   |-- admin.controller.ts
|   |   |-- auth.controller.ts
|   |   |-- city.controller.ts
|   |   |-- feedback.controller.ts
|   |   |-- grid.controller.ts
|   |   |-- infra.controller.ts
|   |   |-- mypage.controller.ts
|   |   |-- notification.controller.ts
|   |   |-- report.controller.ts
|   |   |-- sync.controller.ts
|   |   `-- upload.controller.ts
|   |-- middlewares/
|   |   |-- auth.middleware.ts    # JWT 검증 (일반 유저)
|   |   `-- admin.middleware.ts   # 세션 검증 (관리자)
|   |-- routes/
|   |   |-- accidentZone.routes.ts
|   |   |-- admin.routes.ts
|   |   |-- auth.routes.ts
|   |   |-- city.routes.ts
|   |   |-- feedback.routes.ts
|   |   |-- grid.routes.ts
|   |   |-- health.routes.ts
|   |   |-- infra.routes.ts
|   |   |-- mypage.routes.ts
|   |   |-- notification.routes.ts
|   |   |-- report.routes.ts
|   |   |-- sync.routes.ts
|   |   `-- upload.routes.ts
|   |-- jobs/                     # 안전등급 배치
|   |   |-- runScore.ts
|   |   |-- scoreOps.ts
|   |   |-- scoreScheduler.ts
|   |   `-- weights.ts
|   |-- type/
|   |   `-- express-session.d.ts
|   |-- utils/
|   |   |-- commonUtils.ts
|   |   |-- dateUtils.ts
|   |   |-- gridUtils.ts
|   |   |-- imageUpload.ts
|   |   |-- imgMasking.ts
|   |   |-- koroadAccident.service.ts
|   |   `-- notification.service.ts
|   `-- app.ts                    # Express 앱·라우트 마운트
|-- uploads/                      # 업로드 이미지 저장
|-- .env.example
|-- package.json
`-- README.md
```

---

**아키텍쳐 구조도 Architecture**

```mermaid
flowchart TB
  subgraph Clients
    WEB["Web Admin Next.js"]
    APP["Mobile App"]
  end

  subgraph Backend["Backend Express TypeScript"]
    MW["CORS Cookie Session"]
    AUTH_MW["authMiddleware JWT"]
    ADMIN_MW["adminMiddleware Session"]
    R_AUTH["auth"]
    R_MAP["grids infrastructures city-events accident-zones"]
    R_USER["reports feedbacks mypage uploads"]
    R_ADMIN["admin"]
    R_SYNC["sync"]
    R_NOTI["notification"]
    CRON["node-cron safety grade batch"]
    MASK["Python image masking"]
  end

  subgraph Data
    DB[("MariaDB Prisma")]
    FS[("uploads")]
  end

  subgraph External
    FCM["Firebase Cloud Messaging"]
    KOROAD["KOROAD OpenAPI"]
  end

  WEB -->|"REST credentials"| MW
  APP -->|"REST JWT FCM"| MW
  MW --> R_AUTH
  MW --> R_MAP
  MW --> R_USER
  MW --> R_ADMIN
  MW --> R_SYNC
  MW --> R_NOTI

  R_USER --> AUTH_MW
  R_ADMIN --> ADMIN_MW

  R_AUTH --> DB
  R_MAP --> DB
  R_USER --> DB
  R_ADMIN --> DB
  R_SYNC --> DB
  R_USER --> FS
  R_USER --> MASK
  MASK --> FS

  R_USER -->|"report push"| FCM
  R_NOTI -->|"token topic"| FCM
  R_MAP -->|"accident zones"| KOROAD
  CRON --> DB
```

**요청 흐름 요약**

| 구분 | 인증 | 주요 경로 |
|---|---|---|
| 일반 유저 | JWT + Refresh | 제보·피드백·마이페이지·업로드 |
| 관리자 | Session 쿠키 | `/admin/*` |
| 공개 | 없음 | 격자·인프라·행사·사고다발·sync·health |
| 비동기 | — | FCM 푸시, 일일 안전등급 cron, DB Event Scheduler |

---

**API 명세**

/docs/API명세서.md 참조

[API 명세서 링크](https://treasure-muscle-85a.notion.site/API-3c6c1c44bf488063b15ff85ac1498c3f?pvs=74)

---

**DB 스케줄러**

```sql
-- 취소되거나 만료된 토큰 정리
CREATE EVENT cleanup_refresh_tokens
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
    DELETE FROM refresh_token
    WHERE
        expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        OR revoked_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 만료된 제보 정보 지도에 미표시
CREATE EVENT update_expired_reports
ON SCHEDULE EVERY 1 DAY
DO
    UPDATE report
    SET is_active = 'N'
    WHERE expire_at < NOW()
      AND is_active = 'Y';
```


---

**본인 역할 Role & Contribution**

로그인, 관리자 페이지, FCM 알림, 마이페이지

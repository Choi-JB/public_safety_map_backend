# Public Safety Map Backend (v1.1.0)

## (1) 실행 방법

```
1. npm install
2. .env.example을 복사해 .env 생성 후 DATABASE_URL, JWT_SECRET, SESSION_SECRET 값 채우기
   DATABASE_URL 형식: mysql://아이디:비밀번호@호스트:3306/public_safety_map
3. npx prisma generate
4. npm run dev
5. http://localhost:{PORT}/health/db 접속해서 DB 연결 확인
```

## (2) 폴더 구조

```
backend/
├── docs/                              # 설계·명세 문서
│   ├── Admin API 명세서.md
│   ├── API명세서.md
│   ├── 기능명세서_v1.2.md
│   ├── 격자_인프라_진행명세서.md
│   ├── 관리자페이지_UI설계서.md
│   ├── 유저피드백게시판_UI설계서.md
│   ├── 시퀀스다이어그램_플로우차트.md
│   ├── 프로젝트구조.md
│   └── 백엔드_진행도_보고서.md
├── prisma/
│   └── schema.prisma                  # DB 스키마 (db pull / generate)
├── src/
│   ├── config/
│   │   ├── env.ts                     # 필수 환경변수 검증
│   │   └── prismaClient.ts            # PrismaClient 싱글톤
│   ├── controllers/
│   │   ├── auth.controller.ts         # 로그인·회원가입·로그아웃·refresh
│   │   ├── grid.controller.ts         # 격자·격자 내 인프라 조회
│   │   ├── infra.controller.ts        # 반경 기준 인프라 조회
│   │   ├── city.controller.ts         # 도시 행사 공개 조회
│   │   ├── report.controller.ts       # 유저 제보 CRUD
│   │   ├── device.controller.ts       # 디바이스 토큰 등록
│   │   ├── feedback.controller.ts     # 유저 피드백
│   │   ├── upload.controller.ts       # 이미지 업로드
│   │   └── admin.controller.ts        # 관리자 대시보드·제보/피드백/행사 관리
│   ├── middlewares/
│   │   ├── auth.middleware.ts         # JWT 검증 (일반 유저)
│   │   └── admin.middleware.ts        # 세션 검증 (관리자)
│   ├── routes/
│   │   ├── health.routes.ts           # /health/db
│   │   ├── auth.routes.ts             # /auth/*
│   │   ├── grid.routes.ts             # /grids
│   │   ├── infra.routes.ts            # /infrastructures
│   │   ├── city.routes.ts             # /city-events
│   │   ├── report.routes.ts           # /reports
│   │   ├── device.routes.ts           # /devices
│   │   ├── feedback.routes.ts         # /feedbacks
│   │   ├── upload.routes.ts           # /upload
│   │   └── admin.routes.ts            # /admin/* (+ adminMiddleware)
│   ├── jobs/                          # 안전등급 배치
│   │   ├── runScore.ts                # CLI 진입점
│   │   ├── scoreOps.ts                # 점수 산출·DB 반영
│   │   ├── weights.ts                 # 가중치·등급 매핑
│   │   └── README.md
│   ├── type/
│   │   └── express-session.d.ts       # 세션·Request 타입 확장
│   ├── utils/
│   │   ├── gridUtils.ts               # 격자 좌표 계산
│   │   ├── dateUtils.ts               # KST 날짜 유틸
│   │   ├── commonUtils.ts             # 타입 목록·refresh token 해시
│   │   └── imageUpload.ts             # multer 이미지 저장 설정
│   └── app.ts                         # Express 앱·라우트 마운트
├── uploads/                           # 업로드 이미지 저장
├── .env.example
├── .gitignore
├── tsconfig.json
├── README.md
└── package.json
```

### 인증 요약 (v1.1)

| 구분 | 방식 | 관련 파일 |
|---|---|---|
| 일반 유저 (`USER`) | Access JWT + Refresh Token(쿠키, DB 해시 저장) | `auth.controller`, `auth.middleware`, `commonUtils`, `refresh_token` 테이블 |
| 관리자 (`ADMIN`) | express-session 쿠키 | `auth.controller`, `admin.middleware`, `admin.routes` |

## (3) 시크릿(JWT_SECRET / SESSION_SECRET) 재발급

유출이 의심되거나 주기적으로 교체할 때:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

위 명령어를 두 번 실행해 나온 값을 각각 `.env`의 `JWT_SECRET`, `SESSION_SECRET`에 채우고 서버를 재시작한다. (`.env` 변경은 `ts-node-dev --respawn`이 자동 반영해주지 않으므로 수동 재시작 필요)

값이 비어있으면 `src/config/env.ts`가 서버 시작 자체를 막는다 (fail-fast) — `"change-me"` 같은 기본값으로 조용히 폴백되지 않도록 하기 위함.

**교체 시 영향**

| 교체 대상 | 영향 |
|---|---|
| `SESSION_SECRET` | 관리자 세션 전부 무효화 → 전원 재로그인 필요 |
| `JWT_SECRET` | 발급된 access token 전부 무효화. refresh token이 유효한 유저는 `client.ts`가 자동으로 `/auth/refresh`를 호출해 새 access token을 받아 재로그인 없이 복구됨 |

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

## (2) 폴더 구조 + 담당 역할

```
backend/
├── docs/                              # 설계·명세 문서
│   ├── Admin API 명세서.md            # 피드백/관리자팀 — 관리자 API (구현 기준)
│   ├── API명세서.md
│   ├── DB설계서_v1.1.md
│   ├── 기능명세서_v1.2.md
│   ├── 격자_인프라_진행명세서.md      # 지도표시팀
│   ├── 관리자페이지_UI설계서.md
│   ├── 유저피드백게시판_UI설계서.md
│   ├── 시퀀스다이어그램_플로우차트.md
│   └── 프로젝트구조.md
├── prisma/
│   └── schema.prisma                  # 공통기반 — DB 스키마 (db pull / generate)
│                                      #   포함: user, refresh_token, report, feedback, …
├── src/
│   ├── config/                        # 공통기반 — PrismaClient 등 설정
│   │   └── prismaClient.ts
│   ├── controllers/
│   │   ├── auth.controller.ts         # 공통기반 — 로그인(USER=JWT+refresh / ADMIN=세션),
│   │   │                              #           회원가입, 로그아웃, refresh
│   │   ├── grid.controller.ts         # 지도표시팀
│   │   ├── city.controller.ts         # 지도표시팀 — 도시 행사(공개)
│   │   ├── report.controller.ts       # 제보/알림팀
│   │   ├── device.controller.ts       # 제보/알림팀
│   │   ├── feedback.controller.ts     # 피드백/관리자팀
│   │   └── admin.controller.ts        # 피드백/관리자팀 — 대시보드·제보/피드백/행사 관리
│   ├── middlewares/                   # 공통기반
│   │   ├── auth.middleware.ts         # JWT 검증 (일반 유저)
│   │   └── admin.middleware.ts        # 세션 검증 (관리자)
│   ├── routes/
│   │   ├── health.routes.ts           # 공통기반 — DB 연결 확인
│   │   ├── auth.routes.ts             # 공통기반 — /auth/login, register, refresh, logout
│   │   ├── grid.routes.ts             # 지도표시팀
│   │   ├── city.routes.ts             # 지도표시팀 — /city-events
│   │   ├── report.routes.ts           # 제보/알림팀
│   │   ├── device.routes.ts           # 제보/알림팀
│   │   ├── feedback.routes.ts         # 피드백/관리자팀
│   │   └── admin.routes.ts            # 피드백/관리자팀 — /admin/* (+ adminMiddleware)
│   ├── type/
│   │   └── express-session.d.ts       # 공통기반 — 세션 타입 확장
│   ├── utils/
│   │   ├── gridUtils.ts               # 공통기반 / 지도표시팀
│   │   ├── dateUtils.ts               # 피드백/관리자팀 — KST 날짜 유틸
│   │   ├── commonUtils.ts             # type 목록 조회 + refresh token 생성/해시
│   │   └── imageUpload.ts             # 제보/알림팀
│   └── app.ts                         # 공통기반 — Express, CORS, cookie-parser,
│                                      #           session, 라우트 마운트
├── uploads/
├── .env.example                       # PORT, DATABASE_URL, JWT_SECRET, SESSION_SECRET
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

## (3) 협업 규칙

⚠️ 각자 담당 폴더/파일 외에는 임의로 수정하지 마세요. 공통 파일(config, middlewares, prisma/schema.prisma 등) 수정이 필요하면 먼저 공통기반 담당자에게 요청하세요.

## (4) 시크릿(JWT_SECRET / SESSION_SECRET) 재발급

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

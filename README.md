# Public Safety Map Backend

## (1) 실행 방법

```
1. npm install
2. .env.example을 복사해 .env 생성 후 DATABASE_URL, JWT_SECRET 값 채우기
   DATABASE_URL 형식: mysql://아이디:비밀번호@호스트:3306/public_safety_map
3. npx prisma generate
4. npm run dev
5. http://localhost:{PORT}/health/db 접속해서 DB 연결 확인
```

## (2) 폴더 구조 + 담당 역할

```
backend/
├── prisma/
│   └── schema.prisma       # 공통기반 — generator/datasource 기본 세팅
├── src/
│   ├── config/             # 공통기반 — PrismaClient 등 설정
│   │   └── prismaClient.ts
│   ├── routes/
│   │   ├── health.routes.ts  # 공통기반 — DB 연결 확인
│   │   ├── auth.routes.ts    # 공통기반
│   │   ├── grid.routes.ts    # 지도표시팀
│   │   ├── report.routes.ts  # 제보/알림팀
│   │   ├── feedback.routes.ts # 피드백/관리자팀
│   │   ├── admin.routes.ts   # 피드백/관리자팀
│   │   └── device.routes.ts  # 제보/알림팀
│   ├── controllers/         # routes와 1:1 대응 (각 담당 팀과 동일)
│   ├── middlewares/         # 공통기반
│   │   ├── auth.middleware.ts
│   │   └── admin.middleware.ts
│   ├── utils/
│   │   ├── gridUtils.ts     # 공통기반
│   │   └── imageUpload.ts   # 제보/알림팀
│   └── app.ts               # 공통기반
├── uploads/
├── .env.example
├── .gitignore
├── tsconfig.json
├── README.md
└── package.json
```

## (3) 협업 규칙

⚠️ 각자 담당 폴더/파일 외에는 임의로 수정하지 마세요. 공통 파일(config, middlewares, prisma/schema.prisma 등) 수정이 필요하면 먼저 공통기반 담당자에게 요청하세요.

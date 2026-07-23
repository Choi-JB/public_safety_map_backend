# Public Safety Map Backend

치안 위험 지도 + 커뮤니티 플랫폼 백엔드 · 제보/알림(FN-02) API 포함.

원격: https://github.com/Yoon975/public_safety_map_backend.git  

추가·누락·차후 일정: **[NOTES.md](./NOTES.md)**  
스키마: 팀 `DB.txt` immutable — Prisma는 **매핑만**.

## (1) 실행 방법

```
1. npm install
2. .env.example을 복사해 .env 생성 후 DATABASE_URL, JWT_SECRET 값 채우기
   DATABASE_URL 형식: mysql://아이디:비밀번호@호스트:3306/public_safety_map
3. npx prisma generate
4. npm run dev
5. http://localhost:4000/api/health 로 확인
```

## (2) 폴더 구조 + 담당 역할

```
├── prisma/
│   └── schema.prisma       # 공통기반
├── src/
│   ├── config/             # 공통기반 — prismaClient.ts
│   ├── routes/             # health, auth, grid, report, feedback, admin, device
│   ├── controllers/        # routes 1:1
│   ├── middlewares/        # auth, admin
│   ├── utils/              # gridUtils, imageUpload (+ faceMask 등 — NOTES)
│   ├── services/           # [추가] 비즈니스 로직 — NOTES.md 참고
│   └── app.ts
├── uploads/
├── masking/                # [추가] 얼굴 모자이크 — NOTES.md 참고
├── NOTES.md
├── .env.example
├── .gitignore
├── tsconfig.json
├── README.md
└── package.json
```

## (3) 협업 규칙

⚠️ 각자 담당 폴더/파일 외에는 임의로 수정하지 마세요. 공통 파일(config, middlewares, prisma/schema.prisma 등) 수정이 필요하면 먼저 공통기반 담당자에게 요청하세요.

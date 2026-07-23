# public_safety_map_backend — 추가·누락·차후 일정

> 원격: https://github.com/Yoon975/public_safety_map_backend.git (`dev`)  
> 이 폴더는 **백엔드 리포지토리 루트**입니다 (`backend/` 상위 래퍼 없음).  
> **배포(push)는 이 문서 작성 시점에 하지 않음.**  
> `DB.txt`는 immutable — Prisma는 기존 MariaDB **매핑만** (Agent가 schema ALTER migration 금지).  
> `city_events.type` = `varchar(50)` (구 ENUM → 문자열 매핑).

---

## 제공 트리 대비

### 트리에 있는 항목 (포함)

| 경로 | 상태 |
|------|------|
| `prisma/schema.prisma` | 있음 (User/Grid/Report/… 매핑) |
| `src/config/prismaClient.ts` | 있음 (+ `index.ts` env) |
| `src/routes/health|auth|grid|report|feedback|admin|device` | 있음 |
| `src/controllers/` | routes 1:1 |
| `src/middlewares/auth|admin` | 있음 |
| `src/utils/gridUtils.ts`, `imageUpload.ts` | 있음 |
| `src/app.ts` | 있음 — API는 `/api` 접두 |
| `uploads/`, `.env.example`, `.gitignore`, `tsconfig`, `README`, `package.json` | 있음 |

### 트리에 없는 추가 (기능 유지용)

| 경로 | 이유 |
|------|------|
| `src/services/` | auth/report/device/cityEvent 비즈니스 로직 |
| `src/routes/cityEvent.routes.ts` 등 | 행사 목록 (프로토타입 패리티) |
| `src/utils/faceMask.ts`, `errors.ts` | 마스킹·에러 공통 |
| `masking/`, `scripts/mask_face.py` | 제보 이미지 얼굴 모자이크 |

### 누락·미구현 (의도적 stub / 차후)

| 항목 | 설명 |
|------|------|
| `grid` / `feedback` / `admin` API | 501 stub — 담당 팀 구현 |
| `POST /devices/register` | 501 — App 단계 |
| 위험 격자 점수 JOIN | 격자 ID 규약 통일 **2차** |
| health 경로 | 본 구현은 `GET /api/health` (원격 README의 `/health/db`와 다를 수 있음 — 공통기반과 맞출 것) |

---

## 차후 일정

1. **1차** — 웹 지도에 risk 산출물 **표시**만 (BE는 정적/파일 제공 여부는 팀 합의)  
2. **2차** — `grid` / risk_pipeline 셀·원점·ID 통일 후 `grid_id`·점수 연동  

---

## 로컬 실행

```bash
npm install
cp .env.example .env   # DATABASE_URL, JWT_SECRET
npx prisma generate
npm run dev
# GET http://localhost:4000/api/health
```

마스킹 사용 시: `cd masking && pip install -r requirements.txt`

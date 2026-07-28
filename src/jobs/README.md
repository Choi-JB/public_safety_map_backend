# jobs — 운영 안전등급 배치

**담당 범위:** `src/jobs/**` 만 수정.  
controllers / routes / prisma schema / gridUtils / FE 는 수정하지 않음.

## 전제

| 항목 | 내용 |
| :--- | :--- |
| 입력 | `infrastructures` + `report` (활성·미만료) |
| 출력 | `grid.safety_grade` (`안전` / `보통` / `불안`) UPDATE만 |
| 스키마 | 변경 없음 |
| 다발지역 CSV | 학습 전용 — 본 배치 미사용 |
| 피드백 | 적립 대기 — 미사용 |

## 실행

기존 `package.json`을 바꾸지 않은 상태:

```bash
# backend 루트, .env DATABASE_URL 필요
npx prisma generate
npx ts-node --transpile-only src/jobs/runScore.ts --dry-run
npx ts-node --transpile-only src/jobs/runScore.ts
```

`ts-node`가 없으면 devDependency로 추가하거나, 아래 scripts 추가를 **합의 후** 진행:

```json
"score": "ts-node --transpile-only src/jobs/runScore.ts",
"score:dry": "ts-node --transpile-only src/jobs/runScore.ts --dry-run"
```

## 파일

| 파일 | 역할 |
| :--- | :--- |
| `weights.ts` | 시설군 가중치·등급 구간 |
| `scoreOps.ts` | 집계·점수·UPDATE |
| `runScore.ts` | CLI 진입점 |

## 등급 매핑

| safety_strength | safety_grade |
| :--- | :--- |
| ≥ 60 | 안전 |
| 40 ~ 60 | 보통 |
| < 40 또는 활성 제보 있음 | 불안 |

# jobs — 운영 안전등급 배치

**담당 범위:** 주로 `src/jobs/**`.  
일일 cron 등록을 위해 `app.ts` listen 콜백에서 `scoreScheduler` 를 호출한다.
## 전제

| 항목 | 내용 |
| :--- | :--- |
| 입력 | `infrastructures` + `report` (DB만, CSV 미사용) |
| 현재 제보 | `is_active=Y` · 미만료 → 감점 (기존) |
| 이력 비중 (B-1) | lookback 내 `grid_id` 있는 제보 전체 → `hist_share_pct` |
| 이력 감점 (B-2) | `hist_penalty = min(CAP, SCALE * log1p(hist_n))` → strength에서 차감 (약함, 기본 SCALE=1.5 CAP=5) |
| 등급 (C안) | 활성 제보 무조건 불안 **제거**. `safety_strength` 상대 3분위(하위=불안·중=보통·상=안전). 제보는 점수 감점에만 반영 |
| 출력 | `grid.safety_grade` UPDATE만 |
| 스키마 | 변경 없음 |
| 사고 CSV / 피드백 | 이번 과정 미사용 |

## 실행

기존 `package.json`을 바꾸지 않은 상태:

```bash
# backend 루트, .env DATABASE_URL 필요
npx prisma generate
npx ts-node --transpile-only src/jobs/runScore.ts --dry-run
npx ts-node --transpile-only src/jobs/runScore.ts
```

## 자동 스케줄 (서버 기동 시)

`app.ts`가 `scoreScheduler`를 등록합니다.

| .env | 기본 | 의미 |
| :--- | :--- | :--- |
| `SCORE_CRON_ENABLED` | `true` | `false`면 스케줄 미등록 |
| `SCORE_CRON_TZ` | `Asia/Seoul` | cron 시간대 |

- 표현식: `0 0 * * *` → **매일 00:00**
- 이전 배치가 덜 끝났으면 스킵
- 수동 실행과 동일하게 `runScoreJob` → `grid.safety_grade` UPDATE

## 파일

| 파일 | 역할 |
| :--- | :--- |
| `weights.ts` | 시설군 가중치·등급 구간 |
| `scoreOps.ts` | 집계·점수·UPDATE |
| `runScore.ts` | CLI 진입점 |
| `scoreScheduler.ts` | 매일 00시 cron |

## 등급 매핑 (C안 — 상대 3분위)

제보 1건 = 무조건 불안 **아님**. 점수는 인프라 − 현재제보감점 − 이력감점.

매 배치마다 `safety_strength`를 정렬해:

| 구간 | safety_grade |
| :--- | :--- |
| 하위 1/3 | 불안 |
| 중위 1/3 | 보통 |
| 상위 1/3 | 안전 |

경계 strength는 실행 로그 `tertile cuts`에 출력.
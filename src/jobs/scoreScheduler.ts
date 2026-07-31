/**
 * 안전등급 일일 배치 스케줄러
 *
 * [무엇을 하나]
 * - 서버가 켜져 있는 동안, 매일 00:00(기본: 한국시간)에
 *   infrastructures + report 로 grid.safety_grade 를 다시 계산·UPDATE 한다.
 * - CLI `runScore.ts` 와 같은 runScoreJob() 을 호출한다.
 *
 * [왜 필요한가]
 * - 제보/인프라가 쌓여도 배치를 안 돌리면 지도 등급이 안 바뀐다.
 * - 운영에서는 하루 1회 갱신이 일반적이다.
 *
 * [환경변수] (.env)
 * - SCORE_CRON_ENABLED : true/false (기본 true). 개발 중 자정 실행이 부담이면 false
 * - SCORE_CRON_TZ      : IANA 시간대 (기본 Asia/Seoul). 서버 OS TZ와 무관하게 한국 자정 기준
 *
 * [주의]
 * - 서버 프로세스가 떠 있어야 cron 이 동작한다 (꺼져 있으면 스킵).
 * - 인스턴스를 여러 대 띄우면 각각 돌 수 있음 → 단일 서버 전제.
 */
import cron from "node-cron";
import { runScoreJob } from "./scoreOps";

/** 이전 배치가 아직 돌고 있으면 중복 실행 방지 */
let running = false;

/**
 * Express listen 성공 후 한 번 호출해 cron 을 등록한다.
 * 등록만 하고, 실제 배치는 매일 00:00 에 비동기로 실행된다.
 */
export function startScoreCron(): void {
  const enabledRaw = (process.env.SCORE_CRON_ENABLED ?? "true").toLowerCase();
  if (enabledRaw === "false" || enabledRaw === "0" || enabledRaw === "off") {
    console.log("[score-cron] disabled (SCORE_CRON_ENABLED=false)");
    return;
  }

  // 한국 자정 = Asia/Seoul 기준 00:00
  const tz = process.env.SCORE_CRON_TZ || "Asia/Seoul";

  // node-cron: 분 시 일 월 요일  → "0 0 * * *" = 매일 0시 0분
  const expr = "0 0 * * *";

  if (!cron.validate(expr)) {
    console.error("[score-cron] invalid expression:", expr);
    return;
  }

  cron.schedule(
    expr,
    async () => {
      // 3만+ 격자 UPDATE 는 1분 전후 걸릴 수 있음 → 겹치면 스킵
      if (running) {
        console.warn("[score-cron] skipped — previous job still running");
        return;
      }
      running = true;
      const started = Date.now();
      console.log(`[score-cron] start at ${new Date().toISOString()} tz=${tz}`);
      try {
        const result = await runScoreJob({ dryRun: false });
        const sec = ((Date.now() - started) / 1000).toFixed(1);
        console.log(
          `[score-cron] done in ${sec}s updated=${result.updated} grades 안전=${result.gradeCounts["안전"]} 보통=${result.gradeCounts["보통"]} 불안=${result.gradeCounts["불안"]}`
        );
      } catch (err) {
        console.error("[score-cron] failed:", err);
      } finally {
        running = false;
      }
    },
    { timezone: tz }
  );

  console.log(`[score-cron] scheduled "${expr}" timezone=${tz}`);
}

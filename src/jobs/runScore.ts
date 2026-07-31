/**
 * CLI: 운영 안전등급 배치 (수동 실행용)
 *
 * 서버가 떠 있으면 scoreScheduler 가 매일 00:00(Asia/Seoul)에도 동일 job 을 돌린다.
 * 가중치 변경·mock 투입 직후 바로 확인하려면 이 CLI 를 쓴다.
 *
 * 실행:
 *   npx ts-node --transpile-only src/jobs/runScore.ts
 *   npx ts-node --transpile-only src/jobs/runScore.ts --dry-run
 */
import { runScoreJob } from "./scoreOps";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[score] start dryRun=${dryRun}`);

  const result = await runScoreJob({ dryRun });

  console.log(`[score] grids=${result.gridCount}`);
  console.log(
    `[score] grades(C tertile) 안전=${result.gradeCounts["안전"]} 보통=${result.gradeCounts["보통"]} 불안=${result.gradeCounts["불안"]}`
  );
  console.log(
    `[score] tertile cuts: 불안≤${result.tertileCuts.lowMax} / 보통≤${result.tertileCuts.midMax} / above→안전`
  );
  console.log(
    `[score] hist lookback=${result.histLookbackDays}d total=${result.histTotal} grids_with_hist=${result.histGrids}`
  );
  console.log(
    `[score] B-2 hist_penalty scale=${result.histPenaltyScale} cap=${result.histPenaltyCap}`
  );
  if (result.histTop.length) {
    console.log("[score] hist share TOP20 (weak penalty applied to strength):");
    for (const h of result.histTop) {
      console.log(
        `   grid=${h.grid_id} hist_n=${h.hist_n} share=${h.hist_share_pct}% hist_pen=${h.hist_penalty} active=${h.report_n} grade=${h.safety_grade} strength=${h.safety_strength}`
      );
    }
  }
  console.log(
    `[score] ${dryRun ? "dry-run (no DB write)" : "updated"}=${result.updated}`
  );
  if (result.sample.length) {
    console.log("[score] lowest strength sample:");
    for (const s of result.sample) {
      console.log(
        `   grid=${s.grid_id} strength=${s.safety_strength} grade=${s.safety_grade} reports=${s.report_n} hist=${s.hist_n} share=${s.hist_share_pct}% hist_pen=${s.hist_penalty}`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("[score] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { default: prisma } = await import("../config/prismaClient");
    await prisma.$disconnect();
  });

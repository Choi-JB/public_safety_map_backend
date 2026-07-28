/**
 * CLI: 운영 안전등급 배치
 *
 * 실행 (package.json scripts 미추가 상태 — 기존 파일 미수정):
 *   npx ts-node --transpile-only src/jobs/runScore.ts
 *   npx ts-node --transpile-only src/jobs/runScore.ts --dry-run
 *
 * scripts 추가가 필요하면 공통기반/팀 합의 후:
 *   "score": "ts-node --transpile-only src/jobs/runScore.ts"
 */
import { runScoreJob } from "./scoreOps";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[score] start dryRun=${dryRun}`);

  const result = await runScoreJob({ dryRun });

  console.log(`[score] grids=${result.gridCount}`);
  console.log(
    `[score] grades 안전=${result.gradeCounts["안전"]} 보통=${result.gradeCounts["보통"]} 불안=${result.gradeCounts["불안"]}`
  );
  console.log(
    `[score] ${dryRun ? "dry-run (no DB write)" : "updated"}=${result.updated}`
  );
  if (result.sample.length) {
    console.log("[score] lowest strength sample:");
    for (const s of result.sample) {
      console.log(
        `   grid=${s.grid_id} strength=${s.safety_strength} grade=${s.safety_grade} reports=${s.report_n}`
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

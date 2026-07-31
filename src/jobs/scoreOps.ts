/**
 * 운영 점수: infrastructures + report → grid.safety_grade UPDATE
 * DB 스키마 변경 없음. 숫자 점수는 메모리에서만 사용.
 * B-1: 이력 제보 비중(hist_share_pct) DB 집계.
 * B-2: hist_penalty 를 점수에 약하게 반영 (CAP·SCALE은 weights).
 */
import prisma from "../config/prismaClient";
import {
  DEFAULT_POINT_WEIGHT,
  EVENT_PENALTY_SCALE,
  FACILITY_SOURCES,
  HIST_LOOKBACK_DAYS,
  HIST_PENALTY_CAP,
  HIST_PENALTY_SCALE,
  INFRA_TYPE_TO_SOURCE,
  PRESENCE_BONUS,
  REPORT_UNIT_WEIGHT,
  SOURCE_WEIGHT,
  SourceKey,
  gradeByTertile,
  tertileCutPoints,
  SafetyGrade,
} from "./weights";

export type GridScoreRow = {
  grid_id: bigint;
  safety_strength: number;
  safety_baseline: number;
  event_penalty: number;
  hist_penalty: number;
  report_n: number;
  hist_n: number;
  hist_share_pct: number;
  safety_grade: SafetyGrade;
};

type Feat = {
  grid_id: bigint;
  cctv_w: number;
  cctv_n: number;
  police_w: number;
  police_n: number;
  fire_w: number;
  fire_n: number;
  conv_w: number;
  conv_n: number;
  report_n: number;
  report_score: number;
  hist_n: number;
};

function emptyFeat(grid_id: bigint): Feat {
  return {
    grid_id,
    cctv_w: 0,
    cctv_n: 0,
    police_w: 0,
    police_n: 0,
    fire_w: 0,
    fire_n: 0,
    conv_w: 0,
    conv_n: 0,
    report_n: 0,
    report_score: 0,
    hist_n: 0,
  };
}

function log1p(x: number): number {
  return Math.log(1 + x);
}

function zscore(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mu = values.reduce((a, b) => a + b, 0) / n;
  let varSum = 0;
  for (const v of values) varSum += (v - mu) ** 2;
  const sigma = Math.sqrt(varSum / n);
  if (sigma < 1e-12) return values.map(() => 0);
  return values.map((v) => (v - mu) / sigma);
}

/** average percentile rank → 0~100 */
function percentileRank01(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based average rank
    const pct = avgRank / n;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = pct;
    i = j + 1;
  }
  return ranks;
}

function facilityRaw(feat: Feat, source: SourceKey): number {
  const w = feat[`${source}_w` as keyof Feat] as number;
  const n = feat[`${source}_n` as keyof Feat] as number;
  let raw = log1p(w);
  const bonus = PRESENCE_BONUS[source];
  if (bonus) raw += bonus * (n > 0 ? 1 : 0);
  return raw;
}

export async function loadFeatures(): Promise<Feat[]> {
  const byGrid = new Map<string, Feat>();

  const infraGroups = await prisma.infrastructures.groupBy({
    by: ["grid_id", "type"],
    _count: { _all: true },
    where: { grid_id: { not: null } },
  });

  for (const g of infraGroups) {
    if (g.grid_id == null) continue;
    const source = g.type ? INFRA_TYPE_TO_SOURCE[g.type] : undefined;
    if (!source) continue;
    const key = g.grid_id.toString();
    let feat = byGrid.get(key);
    if (!feat) {
      feat = emptyFeat(g.grid_id);
      byGrid.set(key, feat);
    }
    const n = g._count._all;
    feat[`${source}_n`] = n;
    feat[`${source}_w`] = n * DEFAULT_POINT_WEIGHT;
  }

  const now = new Date();
  const reports = await prisma.report.findMany({
    where: {
      is_active: "Y",
      grid_id: { not: null },
      OR: [{ expire_at: null }, { expire_at: { gt: now } }],
    },
    select: { grid_id: true },
  });

  for (const r of reports) {
    if (r.grid_id == null) continue;
    const key = r.grid_id.toString();
    let feat = byGrid.get(key);
    if (!feat) {
      feat = emptyFeat(r.grid_id);
      byGrid.set(key, feat);
    }
    feat.report_n += 1;
    feat.report_score += REPORT_UNIT_WEIGHT;
  }

  // B-1: 이력 비중 — lookback 내 grid_id 있는 제보 전체 (Y/N·만료 포함). CSV 없음.
  const lookbackFrom = new Date(
    now.getTime() - HIST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );
  const histGroups = await prisma.report.groupBy({
    by: ["grid_id"],
    where: {
      grid_id: { not: null },
      OR: [
        { created_at: { gte: lookbackFrom } },
        { created_at: null }, // created_at 없는 행도 포함 (실데이터 대비)
      ],
    },
    _count: { _all: true },
  });

  for (const g of histGroups) {
    if (g.grid_id == null) continue;
    const key = g.grid_id.toString();
    let feat = byGrid.get(key);
    if (!feat) {
      feat = emptyFeat(g.grid_id);
      byGrid.set(key, feat);
    }
    feat.hist_n = g._count._all;
  }

  return Array.from(byGrid.values());
}

export function computeScores(features: Feat[]): GridScoreRow[] {
  if (features.length === 0) return [];

  const rawBySource: Record<SourceKey, number[]> = {
    cctv: [],
    police: [],
    fire: [],
    conv: [],
  };
  for (const f of features) {
    for (const src of FACILITY_SOURCES) {
      rawBySource[src].push(facilityRaw(f, src));
    }
  }

  const zBySource: Record<SourceKey, number[]> = {
    cctv: zscore(rawBySource.cctv),
    police: zscore(rawBySource.police),
    fire: zscore(rawBySource.fire),
    conv: zscore(rawBySource.conv),
  };

  const infraScores = features.map((_, i) =>
    FACILITY_SOURCES.reduce(
      (sum, src) => sum + SOURCE_WEIGHT[src] * zBySource[src][i],
      0
    )
  );

  const pct = percentileRank01(infraScores);

  const histTotal = features.reduce((s, f) => s + f.hist_n, 0);

  const partial = features.map((f, i) => {
    const safety_baseline = Math.round(pct[i] * 10000) / 100;
    const event_penalty =
      Math.round(EVENT_PENALTY_SCALE * log1p(f.report_score) * 10000) / 10000;
    // B-2: 이력은 약한 추가 감점 (활성 제보보다 작고 상한 있음)
    const hist_penalty_raw =
      f.hist_n > 0 ? HIST_PENALTY_SCALE * log1p(f.hist_n) : 0;
    const hist_penalty =
      Math.round(Math.min(HIST_PENALTY_CAP, hist_penalty_raw) * 10000) / 10000;
    const safety_strength = Math.min(
      100,
      Math.max(
        0,
        Math.round((safety_baseline - event_penalty - hist_penalty) * 100) /
          100
      )
    );
    const hist_share_pct =
      histTotal > 0
        ? Math.round((f.hist_n / histTotal) * 10000) / 100
        : 0;
    return {
      grid_id: f.grid_id,
      safety_baseline,
      event_penalty,
      hist_penalty,
      safety_strength,
      report_n: f.report_n,
      hist_n: f.hist_n,
      hist_share_pct,
    };
  });

  // C안: 제보 무조건 불안 제거 · strength 상대 3분위로 등급
  const grades = gradeByTertile(partial.map((p) => p.safety_strength));

  return partial.map((p, i) => ({
    ...p,
    safety_grade: grades[i],
  }));
}

export type ApplyOptions = {
  dryRun?: boolean;
  batchSize?: number;
};

export async function applySafetyGrades(
  rows: GridScoreRow[],
  options: ApplyOptions = {}
): Promise<{ updated: number; dryRun: boolean }> {
  const dryRun = Boolean(options.dryRun);
  const batchSize = options.batchSize ?? 200;

  if (dryRun) {
    return { updated: rows.length, dryRun: true };
  }

  let updated = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.grid.update({
          where: { id: row.grid_id },
          data: { safety_grade: row.safety_grade },
        })
      )
    );
    updated += chunk.length;
  }
  return { updated, dryRun: false };
}

export async function runScoreJob(options: ApplyOptions = {}) {
  const features = await loadFeatures();
  const rows = computeScores(features);

  const gradeCounts: Record<SafetyGrade, number> = {
    안전: 0,
    보통: 0,
    불안: 0,
  };
  for (const r of rows) gradeCounts[r.safety_grade] += 1;

  const histTotal = rows.reduce((s, r) => s + r.hist_n, 0);
  const histGrids = rows.filter((r) => r.hist_n > 0).length;
  const histTop = rows
    .slice()
    .filter((r) => r.hist_n > 0)
    .sort((a, b) => b.hist_n - a.hist_n)
    .slice(0, 20)
    .map((r) => ({
      grid_id: r.grid_id.toString(),
      hist_n: r.hist_n,
      hist_share_pct: r.hist_share_pct,
      hist_penalty: r.hist_penalty,
      report_n: r.report_n,
      safety_grade: r.safety_grade,
      safety_strength: r.safety_strength,
    }));

  const result = await applySafetyGrades(rows, options);

  const cuts = tertileCutPoints(rows.map((r) => r.safety_strength));

  return {
    gridCount: rows.length,
    gradeCounts,
    gradeMode: "tertile" as const,
    tertileCuts: cuts,
    histLookbackDays: HIST_LOOKBACK_DAYS,
    histPenaltyScale: HIST_PENALTY_SCALE,
    histPenaltyCap: HIST_PENALTY_CAP,
    histTotal,
    histGrids,
    histTop,
    ...result,
    sample: rows
      .slice()
      .sort((a, b) => a.safety_strength - b.safety_strength)
      .slice(0, 5)
      .map((r) => ({
        grid_id: r.grid_id.toString(),
        safety_strength: r.safety_strength,
        safety_grade: r.safety_grade,
        report_n: r.report_n,
        hist_n: r.hist_n,
        hist_share_pct: r.hist_share_pct,
        hist_penalty: r.hist_penalty,
      })),
  };
}

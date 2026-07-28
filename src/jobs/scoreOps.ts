/**
 * 운영 점수: infrastructures + report → grid.safety_grade UPDATE
 * DB 스키마 변경 없음. 숫자 점수는 메모리에서만 사용.
 */
import prisma from "../config/prismaClient";
import {
  DEFAULT_POINT_WEIGHT,
  EVENT_PENALTY_SCALE,
  FACILITY_SOURCES,
  INFRA_TYPE_TO_SOURCE,
  PRESENCE_BONUS,
  REPORT_UNIT_WEIGHT,
  SOURCE_WEIGHT,
  SourceKey,
  strengthToGrade,
  SafetyGrade,
} from "./weights";

export type GridScoreRow = {
  grid_id: bigint;
  safety_strength: number;
  safety_baseline: number;
  event_penalty: number;
  report_n: number;
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

  return features.map((f, i) => {
    const safety_baseline = Math.round(pct[i] * 10000) / 100;
    const event_penalty =
      Math.round(EVENT_PENALTY_SCALE * log1p(f.report_score) * 10000) / 10000;
    const safety_strength = Math.min(
      100,
      Math.max(0, Math.round((safety_baseline - event_penalty) * 100) / 100)
    );
    const safety_grade = strengthToGrade(safety_strength, f.report_n > 0);
    return {
      grid_id: f.grid_id,
      safety_baseline,
      event_penalty,
      safety_strength,
      report_n: f.report_n,
      safety_grade,
    };
  });
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

  const result = await applySafetyGrades(rows, options);

  return {
    gridCount: rows.length,
    gradeCounts,
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
      })),
  };
}

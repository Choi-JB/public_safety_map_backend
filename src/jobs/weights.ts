/**
 * 운영 점수 가중치·등급 매핑 (스키마 변경 없음).
 * risk_pipeline/config.py 공식을 BE infrastructures.type 에 맞게 이식.
 */

/** DB infrastructures.type → 시설군 키 */
export const INFRA_TYPE_TO_SOURCE: Record<string, SourceKey> = {
  CCTV: "cctv",
  경찰서: "police",
  소방서: "fire",
  편의점: "conv",
};

export type SourceKey = "cctv" | "police" | "fire" | "conv";

export const FACILITY_SOURCES: SourceKey[] = [
  "cctv",
  "police",
  "fire",
  "conv",
];

/** 시설군 상대 비중 (log1p → z-score 후 가중합). 합=1.0 */
export const SOURCE_WEIGHT: Record<SourceKey, number> = {
  cctv: 0.11,
  police: 0.38,
  fire: 0.35,
  conv: 0.16,
};

/** 희소 시설 존재 보너스 (z-score 이전 log1p에 가산) */
export const PRESENCE_BONUS: Record<SourceKey, number> = {
  police: 0.5,
  fire: 0.5,
  conv: 0.0,
  cctv: 0.0,
};

/** 시설 1건당 기본 weight (DB에 subtype 없음) */
export const DEFAULT_POINT_WEIGHT = 1.0;

/** safety_strength 에서 차감: EVENT_PENALTY_SCALE * log1p(report_score) */
export const EVENT_PENALTY_SCALE = 8.0;

/** 활성 제보 1건당 report_score (severity 컬럼 없음) */
export const REPORT_UNIT_WEIGHT = 1.0;

/**
 * 이력 비중 집계 기간 (created_at 기준, 일).
 * Y/N·만료 포함, grid_id 있는 제보만.
 */
export const HIST_LOOKBACK_DAYS = 180;

/**
 * B-2: 이력 추가 감점 (현재 제보 EVENT_PENALTY_SCALE=8 보다 약함)
 * hist_penalty = min(CAP, SCALE * log1p(hist_n))
 */
export const HIST_PENALTY_SCALE = 1.5;
export const HIST_PENALTY_CAP = 5;

/**
 * DB·API 명세: 불안 / 보통 / 안전
 * C안: 고정 컷·「활성 제보=무조건 불안」제거.
 * 배치마다 safety_strength 상대 3분위(tertile)로 등급.
 */
export type SafetyGrade = "안전" | "보통" | "불안";

/** @deprecated C안 이후 미사용 — 상대 3분위 사용 */
export const GRADE_SAFE_MIN = 60;
/** @deprecated C안 이후 미사용 — 상대 3분위 사용 */
export const GRADE_NORMAL_MIN = 40;

/**
 * strengths[i] 가 낮을수록 불안.
 * 하위 1/3 불안 · 중위 1/3 보통 · 상위 1/3 안전.
 * 제보 여부는 등급에 직접 쓰지 않음(이미 strength 감점에 반영).
 */
export function gradeByTertile(strengths: number[]): SafetyGrade[] {
  const n = strengths.length;
  const grades = new Array<SafetyGrade>(n);
  if (n === 0) return grades;

  const indexed = strengths.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v || a.i - b.i);

  const t1 = Math.floor(n / 3);
  const t2 = Math.floor((2 * n) / 3);

  for (let rank = 0; rank < n; rank++) {
    const g: SafetyGrade =
      rank < t1 ? "불안" : rank < t2 ? "보통" : "안전";
    grades[indexed[rank].i] = g;
  }
  return grades;
}

/** 3분위 경계 strength (로그용). lowMax=불안 상한, midMax=보통 상한 */
export function tertileCutPoints(strengths: number[]): {
  lowMax: number | null;
  midMax: number | null;
} {
  if (strengths.length === 0) return { lowMax: null, midMax: null };
  const sorted = [...strengths].sort((a, b) => a - b);
  const t1 = Math.floor(sorted.length / 3);
  const t2 = Math.floor((2 * sorted.length) / 3);
  return {
    lowMax: t1 > 0 ? sorted[t1 - 1] : sorted[0],
    midMax: t2 > 0 ? sorted[t2 - 1] : sorted[0],
  };
}


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
  cctv: 0.3,
  police: 0.25,
  fire: 0.2,
  conv: 0.25,
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
 * DB·API 명세: 불안 / 보통 / 안전
 * (FE gridStyle은 "위험"도 색칠 — 운영 쓰기는 명세 문자열 사용)
 */
export type SafetyGrade = "안전" | "보통" | "불안";

export const GRADE_SAFE_MIN = 60;
export const GRADE_NORMAL_MIN = 40;

export function strengthToGrade(
  strength: number,
  hasActiveReport: boolean
): SafetyGrade {
  if (hasActiveReport || strength < GRADE_NORMAL_MIN) return "불안";
  if (strength < GRADE_SAFE_MIN) return "보통";
  return "안전";
}

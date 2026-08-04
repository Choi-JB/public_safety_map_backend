// 도로교통공단 다발지역 OpenAPI 상수

export type AccidentZoneType =
  | "pedestrian"
  | "bicycle"
  | "motorcycle"
  | "schoolzone";

/** REST path (BASE_URL 뒤 segment). bicycle/schoolzone 은 포털과 다를 수 있음 → curl로 확인 */
export const KOROAD_PATH: Record<AccidentZoneType, string> = {
  pedestrian: "pedstrians", // 공식 철자 pedstrians
  bicycle: "bicycle",
  motorcycle: "motorcycle",
  schoolzone: "schoolzone/child", // 문서 path 와 다르면 여기만 수정
};

/** 확정 searchYearCd */
export const SEARCH_YEAR_CDS: Record<AccidentZoneType, string[]> = {
  pedestrian: ["2025083"], // 보행자 22-24(호출명과 api 기간의 명시가 다름.)
  bicycle: ["2025081", "2024046"], // 자전거 24, 23
  motorcycle: ["2025091"], // 이륜차 22-24(호출명과 api 기간의 명시가 다름.)
  schoolzone: ["2025066", "2024041"], // 어린이보호구역 24, 23
};

export const ALL_ACCIDENT_ZONE_TYPES = Object.keys(
  SEARCH_YEAR_CDS
) as AccidentZoneType[];

export function isAccidentZoneType(v: string): v is AccidentZoneType {
  return (ALL_ACCIDENT_ZONE_TYPES as string[]).includes(v);
}
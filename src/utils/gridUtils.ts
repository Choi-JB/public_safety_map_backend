// 담당: 공통기반

const ORIGIN_LAT = 33.0;
const ORIGIN_LNG = 124.5;
const CELL = 0.01;

export function toRowCol(lat: number, lng: number) {
  return {
    grid_row: Math.floor((lat - ORIGIN_LAT) / CELL),
    grid_col: Math.floor((lng - ORIGIN_LNG) / CELL),
  };
}

/** viewport bbox → grid_row / grid_col 범위 */
export function bboxToRowColRange(
  sw_lat: number,
  sw_lng: number,
  ne_lat: number,
  ne_lng: number
) {
  const sw = toRowCol(sw_lat, sw_lng);
  const ne = toRowCol(ne_lat, ne_lng);
  return {
    min_row: Math.min(sw.grid_row, ne.grid_row),
    max_row: Math.max(sw.grid_row, ne.grid_row),
    min_col: Math.min(sw.grid_col, ne.grid_col),
    max_col: Math.max(sw.grid_col, ne.grid_col),
  };
}
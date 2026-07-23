import prisma from '../config/prismaClient.js';

const ORIGIN_LAT = 33.0;
const ORIGIN_LNG = 124.5;
const CELL = 0.005;

export function toRowCol(lat: number, lng: number) {
  const gridRow = Math.floor((Number(lat) - ORIGIN_LAT) / CELL);
  const gridCol = Math.floor((Number(lng) - ORIGIN_LNG) / CELL);
  return { gridRow, gridCol };
}

/**
 * 격자 매칭 성공 시 grid.id, 없으면 null.
 * 제보 저장/출력의 진실은 lat/lng — grid_id는 선택(DDL NULL 허용).
 */
export async function resolveGridId(lat: number, lng: number): Promise<bigint | null> {
  const { gridRow, gridCol } = toRowCol(lat, lng);
  const grid = await prisma.grid.findFirst({ where: { gridRow, gridCol } });
  return grid ? grid.id : null;
}

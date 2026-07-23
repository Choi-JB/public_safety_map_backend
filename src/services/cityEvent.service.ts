import type { CityEvent } from '@prisma/client';
import prisma from '../config/prismaClient.js';

/** 시작 1시간 전부터 지도에 표시 */
const PREVIEW_BEFORE_START_MS = 60 * 60 * 1000;

function toResponse(row: CityEvent) {
  return {
    id: Number(row.id),
    type: row.type,
    title: row.title,
    description: row.description,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    startAt: row.startAt,
    endAt: row.endAt,
    createdBy: row.createdBy != null ? Number(row.createdBy) : null,
    createdAt: row.createdAt,
  };
}

/**
 * city_events 목록
 * - start_at 없음 또는 now >= start_at - 1h  (= start_at <= now + 1h)
 * - end_at 없음 또는 now <= end_at
 */
export async function listCityEvents() {
  const now = new Date();
  const startDeadline = new Date(now.getTime() + PREVIEW_BEFORE_START_MS);

  const rows = await prisma.cityEvent.findMany({
    where: {
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: startDeadline } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: { id: 'asc' },
  });
  return { items: rows.map(toResponse) };
}

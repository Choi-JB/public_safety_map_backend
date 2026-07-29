// 담당: 지도표시팀 — GET /infrastructures (중심+반경)
import { Request, Response } from "express";
import prisma from "../config/prismaClient";

const ALLOWED_TYPES = new Set(["CCTV", "경찰서", "소방서", "편의점"]);
const DEFAULT_LIMIT = 500;
const MAX_RADIUS_M = 20000;

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 두 좌표 사이 거리(m) — Haversine */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * GET /infrastructures?lat&lng&radius_m&type=
 * 지도 중심+반경 내 인프라 (격자 비종속)
 */
export const listByRadius = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const radius_m = toNumber(req.query.radius_m);

    if (lat === null || lng === null || radius_m === null) {
      res.status(422).json({
        success: false,
        message: "lat, lng, radius_m are required",
      });
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(422).json({
        success: false,
        message: "lat/lng out of range",
      });
      return;
    }

    if (radius_m <= 0 || radius_m > MAX_RADIUS_M) {
      res.status(422).json({
        success: false,
        message: `radius_m must be > 0 and <= ${MAX_RADIUS_M}`,
      });
      return;
    }

    const typeRaw =
      req.query.type !== undefined && req.query.type !== ""
        ? String(req.query.type)
        : undefined;
    if (typeRaw && !ALLOWED_TYPES.has(typeRaw)) {
      res.status(422).json({
        success: false,
        message: "type must be one of CCTV|경찰서|소방서|편의점",
      });
      return;
    }

    // 1차: 외접 바운딩 박스
    const dLat = radius_m / 111320;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const dLng = radius_m / (111320 * Math.max(cosLat, 0.01));

    const rows = await prisma.infrastructures.findMany({
      where: {
        AND: [
          { lat: { gte: lat - dLat, lte: lat + dLat } },
          { lng: { gte: lng - dLng, lte: lng + dLng } },
          ...(typeRaw ? [{ type: typeRaw }] : []),
        ],
      },
      orderBy: { id: "asc" },
      take: DEFAULT_LIMIT * 3, // 원 필터 전 여유분
    });

    const inside = rows
      .filter((r) => {
        if (r.lat == null || r.lng == null) return false;
        return (
          distanceMeters(lat, lng, Number(r.lat), Number(r.lng)) <= radius_m
        );
      })
      .slice(0, DEFAULT_LIMIT);

    res.status(200).json({
      success: true,
      data: inside.map((r) => ({
        id: Number(r.id),
        type: r.type,
        address: r.address,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
      })),
    });
  } catch (err) {
    console.error("[listByRadius]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

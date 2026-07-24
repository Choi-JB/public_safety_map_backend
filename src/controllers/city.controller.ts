// 담당: 지도표시팀 — FN-01-02
import { Request, Response } from "express";
import prisma from "../config/prismaClient";

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** GET /city-events?sw_lat&sw_lng&ne_lat&ne_lng */
export const getCityEvents = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const sw_lat = toNumber(req.query.sw_lat);
    const sw_lng = toNumber(req.query.sw_lng);
    const ne_lat = toNumber(req.query.ne_lat);
    const ne_lng = toNumber(req.query.ne_lng);

    if (
      sw_lat === null ||
      sw_lng === null ||
      ne_lat === null ||
      ne_lng === null
    ) {
      res.status(422).json({
        success: false,
        message: "sw_lat, sw_lng, ne_lat, ne_lng are required",
      });
      return;
    }

    const minLat = Math.min(sw_lat, ne_lat);
    const maxLat = Math.max(sw_lat, ne_lat);
    const minLng = Math.min(sw_lng, ne_lng);
    const maxLng = Math.max(sw_lng, ne_lng);
    const now = new Date();

    const rows = await prisma.city_events.findMany({
      where: {
        lat: { gte: minLat, lte: maxLat },
        lng: { gte: minLng, lte: maxLng },
        end_at: { gt: now },
      },
      orderBy: { start_at: "asc" },
    });

    res.status(200).json({
      success: true,
      data: rows.map((e) => ({
        id: Number(e.id),
        type: e.type,
        title: e.title,
        description: e.description,
        lat: e.lat != null ? Number(e.lat) : null,
        lng: e.lng != null ? Number(e.lng) : null,
        start_at: e.start_at,
        end_at: e.end_at,
      })),
    });
  } catch (err) {
    console.error("[getCityEvents]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
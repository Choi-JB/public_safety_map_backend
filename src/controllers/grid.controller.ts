// 담당: 지도표시팀
import { Request, Response } from "express";
import prisma from "../config/prismaClient";
import { bboxToRowColRange } from "../utils/gridUtils";

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** GET /grids?sw_lat&sw_lng&ne_lat&ne_lng */
export const getGrids = async (req: Request, res: Response): Promise<void> => {
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

    const { min_row, max_row, min_col, max_col } = bboxToRowColRange(
      sw_lat,
      sw_lng,
      ne_lat,
      ne_lng
    );

    const rows = await prisma.grid.findMany({
      where: {
        grid_row: { gte: min_row, lte: max_row },
        grid_col: { gte: min_col, lte: max_col },
      },
      orderBy: [{ grid_row: "asc" }, { grid_col: "asc" }],
    });

    res.status(200).json({
      success: true,
      data: rows.map((g) => ({
        grid_id: Number(g.id),
        lat: g.lat != null ? Number(g.lat) : null,
        lng: g.lng != null ? Number(g.lng) : null,
        infra_count: g.infra_count,
        safety_grade: g.safety_grade,
      })),
    });
  } catch (err) {
    console.error("[getGrids]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** GET /grids/:id/infrastructures?type=CCTV|경찰서|소방서|편의점 */
export const getInfrastructures = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = toNumber(req.params.id);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      res.status(422).json({ success: false, message: "Invalid grid id" });
      return;
    }

    const grid = await prisma.grid.findUnique({ where: { id: BigInt(id) } });
    if (!grid) {
      res.status(404).json({ success: false, message: "Grid not found" });
      return;
    }

    const type =
      req.query.type !== undefined && req.query.type !== ""
        ? String(req.query.type)
        : undefined;

    const rows = await prisma.infrastructures.findMany({
      where: {
        grid_id: BigInt(id),
        ...(type ? { type } : {}),
      },
      orderBy: { id: "asc" },
    });

    res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        id: Number(r.id),
        type: r.type,
        address: r.address,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
      })),
    });
  } catch (err) {
    console.error("[getInfrastructures]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /grids/:id/detail — FN-01-04 인포카드
export const detail = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = toNumber(req.params.id);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      res.status(422).json({ success: false, message: "Invalid grid id" });
      return;
    }

    const gridId = BigInt(id);

    const grid = await prisma.grid.findUnique({ where: { id: gridId } });
    if (!grid) {
      res.status(404).json({ success: false, message: "Grid not found" });
      return;
    }

    // 1) 활성 피드백
    const feedbacks = await prisma.feedback.findMany({
      where: { grid_id: gridId, is_active: "Y" },
      orderBy: { created_at: "desc" },
    });

    // 2) 체감 안전도 비율 (%)
    const counts: Record<string, number> = { 안전: 0, 보통: 0, 불안: 0 };
    for (const f of feedbacks) {
      const key = f.safety_feeling ?? "보통";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const total = feedbacks.length;
    const safety_feeling_ratio =
      total === 0
        ? { 안전: 0, 보통: 0, 불안: 0 }
        : {
            안전: Math.round(((counts["안전"] ?? 0) / total) * 100),
            보통: Math.round(((counts["보통"] ?? 0) / total) * 100),
            불안: Math.round(((counts["불안"] ?? 0) / total) * 100),
          };

    // 3) 최근 피드백 3건
    const recent_feedbacks = feedbacks.slice(0, 3).map((f) => ({
      id: Number(f.id),
      safety_feeling: f.safety_feeling,
      comment: f.comment,
      created_at: f.created_at,
    }));

    // 4) 진행 중 제보
    const reports = await prisma.report.findMany({
      where: {
        grid_id: gridId,
        is_active: "Y",
        expire_at: { gt: new Date() },
      },
      orderBy: { id: "desc" },
    });
    const active_reports = reports.map((r) => ({
      id: Number(r.id),
      type: r.type,
      description: r.description,
      expire_at: r.expire_at,
    }));

    // 5) 태그 (feedback_tag 가 Prisma @@ignore → raw SQL)
    let tags: string[] = [];
    try {
      const tagRows = await prisma.$queryRaw<Array<{ name: string | null }>>`
        SELECT DISTINCT t.name AS name
        FROM feedback f
        INNER JOIN feedback_tag ft ON ft.feedback_id = f.id
        INNER JOIN tag t ON t.id = ft.tag_id
        WHERE f.grid_id = ${gridId}
          AND f.is_active = 'Y'
          AND t.name IS NOT NULL
      `;
      tags = tagRows
        .map((r) => r.name)
        .filter((n): n is string => !!n);
    } catch (tagErr) {
      console.warn("[detail] tags query skipped:", tagErr);
      tags = [];
    }

    res.status(200).json({
      success: true,
      data: {
        grid_id: Number(grid.id),
        lat: grid.lat != null ? Number(grid.lat) : null,
        lng: grid.lng != null ? Number(grid.lng) : null,
        safety_grade: grid.safety_grade,
        infra_count: grid.infra_count,
        tags,
        safety_feeling_ratio,
        recent_feedbacks,
        active_reports,
      },
    });
  } catch (err) {
    console.error("[detail]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
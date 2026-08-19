import { Request, Response } from "express";
import prisma from "../config/prismaClient";

async function getDataVersion(dataType: string) {
  const row = await prisma.data_version.findUnique({
    where: { data_type: dataType },
  });
  return {
    data_type: dataType,
    version: row?.version ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

/** GET /sync/version — 앱 로컬 캐시와 비교할 데이터 버전 */
export const checkDataVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const version_data = await prisma.data_version.findMany({
      select: {
        data_type: true,
        version: true,
        updated_at: true,
      },
    });

    res.status(200).json({
      success: true,
      data: version_data.map((data) => ({
        data_type: String(data.data_type),
        version: String(data.version),
        updated_at: data.updated_at.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[checkDataVersion]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** GET /sync/grids — 앱 캐시용 격자 전체 */
export const getGridSyncData = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [version, rows] = await Promise.all([
      getDataVersion("grid"),
      prisma.grid.findMany({
        orderBy: [{ grid_row: "asc" }, { grid_col: "asc" }],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        data_type: version.data_type,
        version: version.version,
        updated_at: version.updated_at,
        items: rows.map((g) => ({
          grid_id: Number(g.id),
          grid_row: g.grid_row,
          grid_col: g.grid_col,
          lat: g.lat != null ? Number(g.lat) : null,
          lng: g.lng != null ? Number(g.lng) : null,
          infra_count: g.infra_count,
          safety_grade: g.safety_grade,
        })),
      },
    });
  } catch (err) {
    console.error("[getGridSyncData]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const DEFAULT_INFRA_LIMIT = 2000;
const MAX_INFRA_LIMIT = 5000;

/** GET /sync/infrastructures?limit=&cursor= — 앱 캐시용 인프라 (id 커서 페이지네이션) */
export const getInfraSyncData = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : DEFAULT_INFRA_LIMIT;
    const rawCursor = req.query.cursor !== undefined ? Number(req.query.cursor) : 0;

    if (!Number.isInteger(rawLimit) || rawLimit <= 0) {
      res.status(422).json({ success: false, message: "limit must be a positive integer" });
      return;
    }
    if (!Number.isInteger(rawCursor) || rawCursor < 0) {
      res.status(422).json({ success: false, message: "cursor must be a non-negative integer" });
      return;
    }

    const limit = Math.min(rawLimit, MAX_INFRA_LIMIT);

    const [version, rows] = await Promise.all([
      getDataVersion("infrastructure"),
      prisma.infrastructures.findMany({
        where: rawCursor > 0 ? { id: { gt: BigInt(rawCursor) } } : undefined,
        orderBy: { id: "asc" },
        take: limit + 1,
      }),
    ]);

    const has_more = rows.length > limit;
    const page = has_more ? rows.slice(0, limit) : rows;
    const items = page.map((r) => ({
      id: Number(r.id),
      grid_id: r.grid_id != null ? Number(r.grid_id) : null,
      type: r.type,
      address: r.address,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
    }));
    const next_cursor = items.length > 0 ? items[items.length - 1].id : null;

    res.status(200).json({
      success: true,
      data: {
        data_type: version.data_type,
        version: version.version,
        updated_at: version.updated_at,
        items,
        next_cursor,
        has_more,
      },
    });
  } catch (err) {
    console.error("[getInfraSyncData]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 담당: 제보/알림팀
import { Request, Response } from "express";
import prisma from "../config/prismaClient";
import { toRowCol } from "../utils/gridUtils";
//시간 변환 유틸
import { toKstWallClock } from "../utils/dateUtils";
import { sendPushNotification } from "../utils/notification.service";


// function toRowCol(lat: number, lng: number) { ... }

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}


/** gridUtils(공통기반)가 stub이므로 제보 저장용 get-or-create를 여기서 처리 필요시 수정 및 삭제*/
async function resolveOrCreateGridId(lat: number, lng: number): Promise<bigint | null> {
  const { grid_row, grid_col } = toRowCol(lat, lng);
  const existing = await prisma.grid.findFirst({
    where: { grid_row, grid_col },
  });
  if (existing) return existing.id;

  const created = await prisma.grid.create({
    data: {
      grid_row,
      grid_col,
      lat,
      lng,
      infra_count: 0,
      safety_grade: "보통",
    },
  });
  return created.id;
}


function listItem(row: {
  id: bigint;
  type: string | null;
  lat: { toString(): string } | null;
  lng: { toString(): string } | null;
  description: string | null;
  img_url: string | null;
  created_at: Date | null;
  expire_at: Date | null;
  user: { nickname: string | null; role: string | null } | null;
}) {
  return {
    id: Number(row.id),
    type: row.type,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    description: row.description,
    img_url: row.img_url,
    user_nickname: row.user?.nickname ?? null,
    created_at: row.created_at,
    expire_at: row.expire_at,
    is_admin_posted: row.user?.role === "ADMIN",
  };
}

export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const sw_lat = toNumber(req.query.sw_lat);
    const sw_lng = toNumber(req.query.sw_lng);
    const ne_lat = toNumber(req.query.ne_lat);
    const ne_lng = toNumber(req.query.ne_lng);

    const where: {
      is_active: "Y";
      expire_at: { gt: string | Date };
      lat?: { gte: number; lte: number };
      lng?: { gte: number; lte: number };
    } = {
      is_active: "Y",
      expire_at: { gt: toKstWallClock() },
    };

    if (
      sw_lat !== null &&
      sw_lng !== null &&
      ne_lat !== null &&
      ne_lng !== null
    ) {
      where.lat = { gte: sw_lat, lte: ne_lat };
      where.lng = { gte: sw_lng, lte: ne_lng };
    }

    const rows = await prisma.report.findMany({
      where,
      include: {
        user: { select: { nickname: true, role: true } },
      },
      orderBy: { id: "desc" },
    });

    res.status(200).json({
      success: true,
      data: rows.map(listItem),
    });
  } catch (err) {
    console.error("[getReports]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { type, description } = req.body ?? {};
    const lat = toNumber(req.body?.lat);
    const lng = toNumber(req.body?.lng);

    if (!type || lat === null || lng === null || !description) {
      res.status(422).json({
        success: false,
        message: "type, lat, lng, description are required",
      });
      return;
    }

    if (String(type).length > 50) {
      res.status(422).json({ success: false, message: "type maxLength 50" });
      return;
    }

    let img_url: string | null = null;
    if (req.body?.img_url !== undefined && req.body?.img_url !== null) {
      const url = String(req.body.img_url);
      if (url.length > 255) {
        res.status(422).json({ success: false, message: "img_url maxLength 255" });
        return;
      }
      img_url = url;
    }

    const grid_id = await resolveOrCreateGridId(lat, lng);
    const expire_at = toKstWallClock(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const row = await prisma.report.create({
      data: {
        user_id: authUser.id,
        grid_id,
        type: String(type),
        lat,
        lng,
        description: String(description),
        img_url,
        is_active: "Y",
        created_at: toKstWallClock(),
        expire_at,
      },
    }).then(async (report) => {
      //알림 전송 (모든 유저에게 전송)
      await sendPushNotification(
        {
          topic: "all",
          type: "report",
          title: "새로운 제보 등록",
          body:report.description ?? "",
          data: { 
            id: Number(report.id),
            type: report.type,
            description:report.description,
            img_url:report.img_url,
            lat: String(report.lat),
            lng: String(report.lng),
            created_at: toKstWallClock(report.created_at ?? new Date())
          },
        }
      );
      return report;
    });

    res.status(201).json({
      success: true,
      data: {
        id: Number(row.id),
        grid_id: row.grid_id != null ? Number(row.grid_id) : null,
        img_url: row.img_url,
        expire_at: row.expire_at,
      },
    });
  } catch (err) {
    console.error("[createReport]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = toNumber(req.params.id);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      res.status(422).json({ success: false, message: "Invalid report id" });
      return;
    }

    const row = await prisma.report.findUnique({ where: { id: BigInt(id) } });
    if (!row || row.is_active === "N") {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    if (row.user_id === null || row.user_id !== authUser.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const data: {
      description?: string;
      img_url?: string | null;
    } = {};

    if (req.body?.description !== undefined) {
      if (!req.body.description || String(req.body.description).length > 5000) {
        res.status(422).json({ success: false, message: "Invalid description" });
        return;
      }
      data.description = String(req.body.description);
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "img_url")) {
      if (req.body.img_url === null) {
        data.img_url = null;
      } else {
        const url = String(req.body.img_url);
        if (url.length > 255) {
          res.status(422).json({ success: false, message: "img_url maxLength 255" });
          return;
        }
        data.img_url = url;
      }
    }

    const updated = await prisma.report.update({
      where: { id: row.id },
      data,
      include: {
        user: { select: { nickname: true, role: true } },
      },
    });

    res.status(200).json({
      success: true,
      data: listItem(updated),
    });
  } catch (err) {
    console.error("[updateReport]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = toNumber(req.params.id);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      res.status(422).json({ success: false, message: "Invalid report id" });
      return;
    }

    const row = await prisma.report.findUnique({ where: { id: BigInt(id) } });
    if (!row || row.is_active === "N") {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    const isOwner = row.user_id !== null && row.user_id === authUser.id;
    const isAdmin = authUser.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    await prisma.report.update({
      where: { id: row.id },
      data: { is_active: "N" },
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[deleteReport]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

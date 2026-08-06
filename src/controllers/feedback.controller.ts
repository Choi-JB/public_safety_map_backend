// 담당: 피드백/관리자팀
import { Request, Response } from "express";
import prisma from "../config/prismaClient";

const SAFETY_FEELINGS = new Set(["안전", "보통", "불안"]);

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseIdParam(raw: string): bigint | null {
  const n = toNumber(raw);
  if (n === null || !Number.isInteger(n) || n <= 0) return null;
  return BigInt(n);
}

function parseTagIds(raw: unknown): number[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const ids: number[] = [];
  for (const v of raw) {
    const n = toNumber(v);
    if (n === null || !Number.isInteger(n) || n <= 0) return null;
    ids.push(n);
  }
  return [...new Set(ids)];
}

async function assertTagsExist(tagIds: number[]): Promise<boolean> {
  if (tagIds.length === 0) return true;
  const count = await prisma.tag.count({
    where: { id: { in: tagIds.map((id) => BigInt(id)) } },
  });
  return count === tagIds.length;
}

function tagsFromRow(
  feedback_tag: { tag: { id: bigint; name: string | null } }[]
) {
  return feedback_tag.map((ft) => ({
    id: Number(ft.tag.id),
    name: ft.tag.name,
  }));
}

/** GET /feedbacks/tags — 작성 폼 chip용 */
export const getTags = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.tag.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({
      success: true,
      data: rows.map((t) => ({ id: Number(t.id), name: t.name })),
    });
  } catch (err) {
    console.error("[getTags]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /grids/:id/feedbacks
 * body: { safety_feeling, comment?, tag_ids?, img_url? }
 * - 지도 패널에서 선택한 grid_id 로 작성
 * - 동일 user + grid 활성 1건만 (409)
 * - 태그: DB tag.id 만 feedback_tag 에 연결
 */
export const createFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const gridId = parseIdParam(req.params.id);
    if (gridId === null) {
      res.status(422).json({ success: false, message: "Invalid grid id" });
      return;
    }

    const grid = await prisma.grid.findUnique({
      where: { id: gridId },
      select: { id: true },
    });
    if (!grid) {
      res.status(404).json({ success: false, message: "Grid not found" });
      return;
    }

    const safety_feeling =
      req.body?.safety_feeling != null
        ? String(req.body.safety_feeling).trim()
        : "";
    if (!SAFETY_FEELINGS.has(safety_feeling)) {
      res.status(422).json({
        success: false,
        message: "safety_feeling must be one of: 안전, 보통, 불안",
      });
      return;
    }

    const tagIds = parseTagIds(req.body?.tag_ids);
    if (tagIds === null) {
      res.status(422).json({ success: false, message: "Invalid tag_ids" });
      return;
    }
    if (!(await assertTagsExist(tagIds))) {
      res.status(422).json({ success: false, message: "Unknown tag_ids" });
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

    const comment =
      req.body?.comment !== undefined && req.body?.comment !== null
        ? String(req.body.comment)
        : null;

    const duplicated = await prisma.feedback.findFirst({
      where: {
        user_id: authUser.id,
        grid_id: gridId,
        is_active: "Y",
      },
      select: { id: true },
    });
    if (duplicated) {
      res.status(409).json({
        success: false,
        message: "Feedback already exists for this grid",
      });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const fb = await tx.feedback.create({
        data: {
          user_id: authUser.id,
          grid_id: gridId,
          safety_feeling,
          comment,
          img_url,
          is_active: "Y",
          created_at: new Date(),
        },
      });

      if (tagIds.length > 0) {
        await tx.feedback_tag.createMany({
          data: tagIds.map((tag_id) => ({
            feedback_id: fb.id,
            tag_id: BigInt(tag_id),
          })),
        });
      }

      return tx.feedback.findUniqueOrThrow({
        where: { id: fb.id },
        include: {
          feedback_tag: {
            select: { tag: { select: { id: true, name: true } } },
          },
        },
      });
    });

    res.status(201).json({
      success: true,
      data: {
        id: Number(created.id),
        grid_id: Number(gridId),
        safety_feeling: created.safety_feeling,
        comment: created.comment,
        img_url: created.img_url,
        tags: tagsFromRow(created.feedback_tag),
        created_at: created.created_at,
      },
    });
  } catch (err) {
    console.error("[createFeedback]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** PATCH /feedbacks/:id — 마이페이지 수정 (본인) */
export const updateFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(422).json({ success: false, message: "Invalid feedback id" });
      return;
    }

    const row = await prisma.feedback.findUnique({ where: { id } });
    if (!row || row.is_active === "N") {
      res.status(404).json({ success: false, message: "Feedback not found" });
      return;
    }
    if (row.user_id === null || row.user_id !== authUser.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const data: {
      safety_feeling?: string;
      comment?: string | null;
      img_url?: string | null;
    } = {};

    if (req.body?.safety_feeling !== undefined) {
      const feeling = String(req.body.safety_feeling).trim();
      if (!SAFETY_FEELINGS.has(feeling)) {
        res.status(422).json({
          success: false,
          message: "safety_feeling must be one of: 안전, 보통, 불안",
        });
        return;
      }
      data.safety_feeling = feeling;
    }

    if (req.body?.comment !== undefined) {
      data.comment =
        req.body.comment === null ? null : String(req.body.comment);
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "img_url")) {
      if (req.body.img_url === null) {
        data.img_url = null;
      } else {
        const url = String(req.body.img_url);
        if (url.length > 255) {
          res.status(422).json({
            success: false,
            message: "img_url maxLength 255",
          });
          return;
        }
        data.img_url = url;
      }
    }

    let tagIds: number[] | undefined;
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "tag_ids")) {
      const parsed = parseTagIds(req.body.tag_ids);
      if (parsed === null) {
        res.status(422).json({ success: false, message: "Invalid tag_ids" });
        return;
      }
      if (!(await assertTagsExist(parsed))) {
        res.status(422).json({ success: false, message: "Unknown tag_ids" });
        return;
      }
      tagIds = parsed;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.feedback.update({ where: { id }, data });
      }
      if (tagIds !== undefined) {
        await tx.feedback_tag.deleteMany({ where: { feedback_id: id } });
        if (tagIds.length > 0) {
          await tx.feedback_tag.createMany({
            data: tagIds.map((tag_id) => ({
              feedback_id: id,
              tag_id: BigInt(tag_id),
            })),
          });
        }
      }
      return tx.feedback.findUniqueOrThrow({
        where: { id },
        include: {
          feedback_tag: {
            select: { tag: { select: { id: true, name: true } } },
          },
        },
      });
    });

    res.status(200).json({
      success: true,
      data: {
        id: Number(updated.id),
        grid_id: updated.grid_id != null ? Number(updated.grid_id) : null,
        safety_feeling: updated.safety_feeling,
        comment: updated.comment,
        img_url: updated.img_url,
        tags: tagsFromRow(updated.feedback_tag),
        created_at: updated.created_at,
      },
    });
  } catch (err) {
    console.error("[updateFeedback]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** DELETE /feedbacks/:id — 마이페이지 삭제 (소프트, 본인 또는 ADMIN) */
export const deleteFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(422).json({ success: false, message: "Invalid feedback id" });
      return;
    }

    const row = await prisma.feedback.findUnique({ where: { id } });
    if (!row || row.is_active === "N") {
      res.status(404).json({ success: false, message: "Feedback not found" });
      return;
    }

    const isOwner = row.user_id !== null && row.user_id === authUser.id;
    const isAdmin = authUser.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    await prisma.feedback.update({
      where: { id },
      data: { is_active: "N" },
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[deleteFeedback]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
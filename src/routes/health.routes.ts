// 담당: 공통기반
import { Router, Request, Response } from "express";
import prismaClient from "../config/prismaClient";

const router = Router();

// GET /health — 서버 기동 여부 확인
router.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// GET /health/db — DB 연결 확인 (인증 없음)
router.get("/db", async (_req: Request, res: Response) => {
  try {
    await prismaClient.$queryRaw`SELECT 1`;
    res.json({ db: "connected" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";
    res.status(500).json({ db: "disconnected", error: message });
  }
});

export default router;

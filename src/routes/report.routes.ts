// 담당: 제보/알림팀
import { Router } from "express";
import {
  getReports,
  createReport,
  updateReport,
  deleteReport,
} from "../controllers/report.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", getReports);
router.post("/", authMiddleware, createReport);
router.patch("/:id", authMiddleware, updateReport);
router.delete("/:id", authMiddleware, deleteReport);

export default router;

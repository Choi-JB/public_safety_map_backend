// 담당: 제보/알림팀
import { Router } from "express";
import {
  getReports,
  createReport,
  updateReport,
  deleteReport,
} from "../controllers/report.controller";

const router = Router();

router.get("/", getReports);
router.post("/", createReport);
router.patch("/:id", updateReport);
router.delete("/:id", deleteReport);

export default router;

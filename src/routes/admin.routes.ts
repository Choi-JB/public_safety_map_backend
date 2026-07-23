// 담당: 피드백/관리자팀
import { Router } from "express";
import { getAdminSummary, getUserReports, deleteUserReport } from "../controllers/admin.controller";

const router = Router();

router.get("/summary", getAdminSummary);
router.get("/reports", getUserReports);
router.post("/delete", deleteUserReport);

// TODO: GET /admin/users — 사용자 관리
// TODO: GET /admin/reports — 제보 관리
// TODO: PATCH /admin/reports/:id/status — 제보 상태 변경

export default router;

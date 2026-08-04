import { Router } from "express";
import { getMypage, getMyReportList, getMyFeedbackList } from "../controllers/mypage.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

//GET /mypage — 마이페이지 정보 조회
router.get("/", authMiddleware, getMypage);
//GET /mypage/report — 내가 제보한 report 목록 조회
router.get("/report", authMiddleware, getMyReportList);
//GET /mypage/feedback — 내가 제보한 feedback 목록 조회
router.get("/feedback", authMiddleware, getMyFeedbackList);

export default router;
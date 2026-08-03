import { Router } from "express";
import { getMypage, getMyReportList, getMyFeedbackList } from "../controllers/mypage.controller";

const router = Router();

//GET /mypage — 마이페이지 정보 조회
router.post("/", getMypage);
//GET /mypage/report — 내가 제보한 report 목록 조회
router.post("/report", getMyReportList);
//GET /mypage/feedback — 내가 제보한 feedback 목록 조회
router.post("/feedback", getMyFeedbackList);

export default router;
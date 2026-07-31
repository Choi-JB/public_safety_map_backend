// 담당: 피드백/관리자팀
// 작성자: 최정봉
// 내용 : 관리자 관련 라우트
import { Router } from "express";
import { 
    getAdminSummary, 


    getUserReports, 
    createUserReport,
    deleteUserReport, 

    getFeedbackList, 
    deleteFeedback,

    getCityEvents,
    createCityEvent,
    updateCityEvent,
    deleteCityEvent,

    getAdminMe,
    restoreUserReport,
    restoreCityEvent,
    getGridId,
} from "../controllers/admin.controller";

import { adminMiddleware } from "../middlewares/admin.middleware";

const router = Router();

// ★ /admin/* 요청마다 세션 검사
router.use(adminMiddleware);

router.get("/summary", getAdminSummary);
router.get("/reports", getUserReports);
router.post("/create-report", createUserReport);
router.post("/delete-report", deleteUserReport);
router.post("/restore-report", restoreUserReport);
router.get("/feedbacks", getFeedbackList);
router.post("/delete-feedback", deleteFeedback);
router.get("/events", getCityEvents);
router.post("/create-event", createCityEvent);
router.post("/update-event", updateCityEvent);
router.post("/delete-event", deleteCityEvent);
router.post("/restore-event", restoreCityEvent);
router.get("/me", getAdminMe);
router.get("/grid-id", getGridId);

// TODO: GET /admin/users — 사용자 관리
// TODO: GET /admin/reports — 제보 관리
// TODO: PATCH /admin/reports/:id/status — 제보 상태 변경

export default router;

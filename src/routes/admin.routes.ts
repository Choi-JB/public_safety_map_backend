// 담당: 피드백/관리자팀
// 작성자: 최정봉
// 내용 : 관리자 관련 라우트
import { Router } from "express";
import { 
    getAdminSummary, 
    getUserReports, 
    deleteUserReport, 
    getFeedbackList, 
    deleteFeedback,
    getCityEvents,
    createCityEvent,
    updateCityEvent,
    deleteCityEvent,

} from "../controllers/admin.controller";

const router = Router();

router.get("/summary", getAdminSummary);
router.get("/reports", getUserReports);
router.post("/delete-report", deleteUserReport);
router.get("/feedbacks", getFeedbackList);
router.post("/delete-feedback", deleteFeedback);
router.get("/events", getCityEvents);
router.post("/create-event", createCityEvent);
router.post("/update-event", updateCityEvent);
router.post("/delete-event", deleteCityEvent);


// TODO: GET /admin/users — 사용자 관리
// TODO: GET /admin/reports — 제보 관리
// TODO: PATCH /admin/reports/:id/status — 제보 상태 변경

export default router;

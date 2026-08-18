// 담당: 지도표시팀
import { Router } from "express";
import {setNotificationToken, sendNotification, unlinkNotificationToken} from "../controllers/notification.controller";
import { optionalAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// TODO: POST /notification/register — 알림 토큰 설정
router.post("/register", setNotificationToken);
router.post("/send-all", sendNotification);
router.patch("/unregister", unlinkNotificationToken);

export default router;



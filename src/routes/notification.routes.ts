// 담당: 지도표시팀
import { Router } from "express";
import {setNotificationToken, sendNotification} from "../controllers/notification.controller";
import { optionalAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// TODO: POST /notification/register — 알림 토큰 설정
router.post("/register", optionalAuthMiddleware, setNotificationToken);
router.post("/send-all", sendNotification);

export default router;



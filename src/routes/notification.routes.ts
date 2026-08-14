// 담당: 지도표시팀
import { Router } from "express";
import {setNotificationToken, sendNotification} from "../controllers/notification.controller";
import { optionalAuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// TODO: POST /alarm/set-token — 알림 토큰 설정
router.post("/set-token", optionalAuthMiddleware, setNotificationToken);
router.post("/send", sendNotification);

export default router;



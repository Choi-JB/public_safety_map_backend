// 담당: 지도표시팀 — FN-01-02
import { Router } from "express";
import { getCityEvents } from "../controllers/city.controller";

const router = Router();

router.get("/", getCityEvents);

export default router;
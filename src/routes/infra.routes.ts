// 담당: 지도표시팀 — FN 인프라 반경 조회
import { Router } from "express";
import { listByRadius } from "../controllers/infra.controller";

const router = Router();

/** GET /infrastructures?lat&lng&radius_m&type= */
router.get("/", listByRadius);

export default router;

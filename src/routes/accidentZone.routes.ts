// 담당: 지도표시팀 — 교통사고 다발지역
import { Router } from "express";
import { listAccidentZones } from "../controllers/accidentZone.controller";

const router = Router();

/** GET /accident-zones?type=&siDo=&guGun= */
router.get("/", listAccidentZones);

export default router;
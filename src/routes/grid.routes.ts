// 담당: 지도표시팀
import { Router } from "express";
import { getGrids } from "../controllers/grid.controller";
import { getInfrastructures } from "../controllers/grid.controller";
import { detail } from "../controllers/grid.controller";

const router = Router();

// TODO: GET /grids — 격자 목록 조회
router.get("/", getGrids);
// TODO: GET /grids/:id/infrastructures — 격자 내 인프라 조회
router.get("/:id/infrastructures", getInfrastructures);
// TODO: GET /grids/:id/detail — 격자 상세 정보 조회
router.get("/:id/detail", detail);



export default router;

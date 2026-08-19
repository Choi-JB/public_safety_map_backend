import { Router } from "express";
import {
  checkDataVersion,
  getGridSyncData,
  getInfraSyncData,
} from "../controllers/sync.controller";

const router = Router();

router.get("/version", checkDataVersion);
router.get("/grids", getGridSyncData);
router.get("/infrastructures", getInfraSyncData);

export default router;

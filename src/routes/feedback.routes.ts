// 담당: 피드백/관리자팀
import { Router } from "express";
import {
  getTags,
  updateFeedback,
  deleteFeedback,
} from "../controllers/feedback.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// GET /feedbacks/tags  — 반드시 /:id 보다 위
router.get("/tags", getTags);

// PATCH|DELETE /feedbacks/:id  — 마이페이지
router.patch("/:id", authMiddleware, updateFeedback);
router.delete("/:id", authMiddleware, deleteFeedback);

export default router;
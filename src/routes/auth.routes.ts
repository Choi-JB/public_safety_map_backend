// 담당: 공통기반
import { Router } from "express";
import { login, logout, refresh } from "../controllers/auth.controller";
import { register } from "../controllers/auth.controller";

const router = Router();

// TODO: POST /auth/login — 로그인
router.post("/login", login);
// TODO: POST /auth/register — 회원가입
router.post("/register", register);
// TODO: POST /auth/refresh — 토큰 갱신
router.post("/refresh", refresh);
// TODO: POST /auth/logout — 로그아웃
router.post("/logout", logout);

export default router;

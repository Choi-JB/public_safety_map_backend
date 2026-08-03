// 담당: 공통기반
import { Router } from "express";
import { login, logout, refresh } from "../controllers/auth.controller";
import { register, changePassword } from "../controllers/auth.controller";

const router = Router();

//POST /auth/login — 로그인
router.post("/login", login);
//POST /auth/register — 회원가입
router.post("/register", register);
//POST /auth/refresh — 토큰 갱신
router.post("/refresh", refresh);
//POST /auth/logout — 로그아웃
router.post("/logout", logout);
//POST /auth/changePassword — 비밀번호 변경
router.post("/change-pw", changePassword);

export default router;

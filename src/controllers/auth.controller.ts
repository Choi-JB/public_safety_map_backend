// 담당: 공통기반
// 작성자 : 최정봉
// 내용 : 로그인, 회원가입 컨트롤러
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient";

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LEN = 8;

/** 문자열 비어있는지 체크 */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** 로그인 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // 유효성 검사: 이메일, 비밀번호 비어있는지 체크
    const email = isNonEmptyString(req.body.email)
      ? req.body.email.trim()
      : "";
    const password = isNonEmptyString(req.body.password)
      ? req.body.password
      : "";
    if (!email || !password) {
      res.status(422).json({
        success: false,
        message: "email, password are required",
      });
      return;
    }

    // 이메일 조회
    const user = await prisma.user.findFirst({ where:{ email}  });
    if (!user || !user.password_hash) {
      res.status(401).json({
        success: false,
        message: "Invalid email",
      });
      return;
    }
    // 계정 활성화 여부 체크
    if (user.is_active !== "Y") {
      res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
      return;
    }


    // 비밀번호 검증
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({
        success: false,
        message: "Invalid password",
      });
      return;
    }

    // 관리자 로그인 처리
    if (user.role === "ADMIN") {
      // 관리자 → 세션
      (req as any).session.userId = String(user.id);
      (req as any).session.role = "ADMIN";
      (req as any).session.nickname = user.nickname ?? undefined;
      res.status(200).json({
        success: true,
        data: {
          authType: "session",
          user: {
            id: Number(user.id),
            nickname: user.nickname,
            role: user.role,
          },
        },
      });
      return;
    }


    // 일반 유저 로그인 처리
    // const secret = process.env.JWT_SECRET;
    // if (!secret) {
    //   console.error("[login] JWT_SECRET is missing");
    //   res.status(500).json({ success: false, message: "Internal server error" });
    //   return;
    // }
    
    // report.controller requireAuthUser: payload.sub | userId | id
    const access_token = jwt.sign(
      { role: user.role },
      process.env.JWT_SECRET || "change-me",
      { subject: String(user.id), expiresIn: "7d" }
    );
    res.status(200).json({
      success: true,
      data: {
        access_token,
        user: {
          id: Number(user.id),
          nickname: user.nickname,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** 로그아웃 (관리자 세션 종료) */
export const logout = async (req: Request, res: Response): Promise<void> => {
  const session = req.session;
  if (!session) {
    res.status(200).json({ success: true, message: "Already logged out" });
    return;
  }
  session.destroy((err) => {
    if (err) {
      console.error("[logout]", err);
      res.status(500).json({ success: false, message: "Internal server error" });
      return;
    }
    res.clearCookie("connect.sid");
    res.status(200).json({ success: true, message: "Logged out" });
  });
};


/** 회원가입 */
export const register = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
  try {
    const email = isNonEmptyString(req.body.email)
      ? req.body.email.trim()
      : "";
    const password = isNonEmptyString(req.body.password)
      ? req.body.password
      : "";
    const nickname = isNonEmptyString(req.body.nickname)
      ? req.body.nickname.trim()
      : "";
    if (!email || !password || !nickname) {
      res.status(422).json({
        success: false,
        message: "email, password, nickname are required",
      });
      return;
    }
    if (email.length > 50 || nickname.length > 50) {
      res.status(422).json({
        success: false,
        message: "email/nickname too long",
      });
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      res.status(422).json({
        success: false,
        message: `password must be at least ${MIN_PASSWORD_LEN} characters`,
      });
      return;
    }
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, message: "Email already exists" });
      return;
    }
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        nickname,
        password_hash,
        role: "NORMAL", // 클라이언트 지정 불가
        is_active: "Y",
        created_at: new Date(),
      },
    });
    res.status(201).json({
      success: true,
      data: {
        id: Number(user.id),
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[signup]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

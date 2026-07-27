// 담당: 공통기반
// 작성자 : 최정봉
// 내용 : 로그인, 회원가입 컨트롤러
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient";
import { generateRefreshToken, hashRefreshToken } from "../utils/commonUtils";

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
    const user = await prisma.user.findFirst({ where: { email } });
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

    // 일반 유저 로그인 처리 - access token은 짧게, refresh token으로 갱신
    const access_token = jwt.sign(
      { role: user.role },
      process.env.JWT_SECRET || "change-me",
      { subject: String(user.id), expiresIn: "1h" } //만료시간 1시간
    );

    // refresh token 발급 (원본은 쿠키로, 해시만 DB에 저장)
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await prisma.refresh_token.create({
      data: {
        user_id: user.id,
        token_hash: hashRefreshToken(refreshToken),
        expires_at: refreshExpiresAt,
        created_at: new Date(),
      },
    });
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: false, // 배포 HTTPS면 true
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

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

/** 토큰 갱신 (refresh token 검증 → 로테이션 → 새 access token 발급) */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const incomingToken = req.cookies?.refresh_token;
    //쿠키에 refresh token 유무 확인
    if (!incomingToken) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    //refresh token 해시 생성
    const tokenHash = hashRefreshToken(incomingToken);
    //DB에 저장된 refresh token 조회
    const stored = await prisma.refresh_token.findUnique({
      where: { token_hash: tokenHash },
    });

    //DB에 저장된 refresh token 없으면 401 에러
    if (!stored) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // 재사용 탐지: 이미 폐기된 토큰이 다시 들어옴 → 탈취 의심 → 해당 유저 전체 토큰 폐기
    if (stored.revoked_at) {
      await prisma.refresh_token.updateMany({
        where: { user_id: stored.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      res.clearCookie("refresh_token");
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // 만료 체크 : 만료된 토큰이 들어오면 401 에러
    if (stored.expires_at < new Date()) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: stored.user_id } });

    if (!user || user.is_active !== "Y") {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // 로테이션: 기존 토큰 폐기 + 새 토큰 발급 (트랜잭션으로 묶어 원자성 보장)
    const newRefreshToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.refresh_token.update({
        where: { id: stored.id },
        data: { revoked_at: new Date() },
      }),
      prisma.refresh_token.create({
        data: {
          user_id: user.id,
          token_hash: hashRefreshToken(newRefreshToken),
          expires_at: newExpiresAt,
          created_at: new Date(),
        },
      }),
    ]);

    res.cookie("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: false, // 배포 HTTPS면 true
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    const access_token = jwt.sign(
      { role: user.role },
      process.env.JWT_SECRET || "change-me",
      { subject: String(user.id), expiresIn: "1h" }
    );

    res.status(200).json({
      success: true,
      data: { access_token },
    });

  } catch (err) {
    console.error("[refresh]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }

};


/** 로그아웃 (관리자 세션 종료 + 유저 refresh token 폐기) */
export const logout = async (req: Request, res: Response): Promise<void> => {

  try {
    //일반 유저 : refresh token 폐기
    const incomingToken = req.cookies?.refresh_token;
    if (incomingToken) {
      const tokenHash = hashRefreshToken(incomingToken);
      await prisma.refresh_token.updateMany({
        where: { token_hash: tokenHash, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      res.clearCookie("refresh_token");
    }

    //관리자 : 세션 종료
    const session = req.session;
    if (!session || !session.userId) {
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

  } catch (err) {
    console.error("[logout]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }

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
        role: "USER", // 클라이언트 지정 불가
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

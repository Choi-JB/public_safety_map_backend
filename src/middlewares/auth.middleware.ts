// 작성자 : 최정봉
// 내용: 유저 인증 미들웨어
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
//import prisma from "../config/prismaClient";
import { JWT_SECRET } from "../config/env";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  // Bearer 스킴이 아니거나 토큰이 없으면 401 에러 반환
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ success: false, message: "Unauthorized 유효한 토큰이 아닙니다." });
    return;
  }

  // JWT_SECRET 환경 변수가 없으면 500 에러 반환
  // const secret = process.env.JWT_SECRET;
  // if (!secret) {
  //   res.status(500).json({ success: false, message: "Internal server error" });
  //   return;
  // }   -> 현재 없으면 아에 서버 가동이 안되게 변경함

  try {
    // JWT 토큰 검증
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const rawId = payload.sub ?? payload.userId ?? payload.id;
    // rawId가 undefined 또는 null이면 401 에러 반환 (토큰이 유효하지 않을 경우)
    if (rawId === undefined || rawId === null) {
      res.status(401).json({ success: false, message: "Unauthorized 유효한 토큰이 아닙니다." });
      return;
    }

    // 서명·만료만 검증(DB 조회 없음). 계정 비활성화는 Refresh 시점에서 차단되어 Access Token 수명 이내에 반영됨

    (req as any).user = { id: BigInt(String(rawId)), role: payload.role };
    next();
  } catch {
    res.status(401).json({ success: false, message: "Unauthorized 유효한 토큰이 아닙니다." });
  }
};

/**
 * 선택 인증: Bearer 없으면 비로그인으로 통과.
 * 토큰이 있으면 검증하고 req.user를 채움. 잘못된 토큰은 401.
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const rawId = payload.sub ?? payload.userId ?? payload.id;
    if (rawId === undefined || rawId === null) {
      res.status(401).json({ success: false, message: "Unauthorized 유효한 토큰이 아닙니다." });
      return;
    }

    // 서명·만료만 검증(DB 조회 없음). 계정 비활성화는 Refresh 시점에서 차단되어 Access Token 수명 이내에 반영됨

    (req as any).user = { id: BigInt(String(rawId)), role: payload.role };
    next();
  } catch {
    res.status(401).json({ success: false, message: "Unauthorized 유효한 토큰이 아닙니다." });
  }
};
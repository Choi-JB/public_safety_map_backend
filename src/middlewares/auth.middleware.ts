// 작성자 : 최정봉
// 내용: 유저 인증 미들웨어
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient";
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

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: BigInt(String(rawId)) },
    });
    //유효성 검사: user가 없거나 is_active가 Y가 아니면 401 에러 반환
    if (!user || user.is_active !== "Y") {
      res.status(401).json({ success: false, message: "Unauthorized 비활성화된 계정입니다. 관리자에게 문의해주세요." });
      return;
    }

    (req as any).user = { id: user.id, role: user.role };
    next();
  } catch {
    res.status(401).json({ success: false, message: "Unauthorized 유효한 토큰이 아닙니다." });
  }
};
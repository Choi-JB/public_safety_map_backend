// 작성자 : 최정봉
// 내용: 관리자 권한 검증 미들웨어
import { Request, Response, NextFunction } from "express";
import prisma from "../config/prismaClient";

/**
 * 관리자 권한 검증 미들웨어
 * @param req - 요청 객체, session에 userId와 role이 있어야 함
 * @param res - 응답 객체
 * @param next - 다음 미들웨어 함수
 */
export const adminMiddleware = async (
  req: Request & { session?: { userId?: string; role?: string } },
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.session?.userId || req.session.role !== "ADMIN") {
    res.status(401).json({ success: false, message: "Unauthorized! 권한이 없습니다!" });
    return;
  }

  // 동시 세션 제한: 다른 곳에서 새로 로그인해서 이 세션이 무효화됐는지 확인
  const user = await prisma.user.findUnique({
    where: { id: BigInt(req.session.userId) },
  });
  if (!user || user.active_session_id !== req.sessionID) {
    req.session.destroy(() => { });
    res.status(403).json({
      success: false,
      message: "다른 곳에서 로그인되어 세션이 만료되었습니다.",
    });
    return;
  }

  //관리자 정보 저장 -> admin.controller.ts에서 getAdminMe 함수에서 사용
  (req as any).admin = {
    id: req.session.userId,
    role: req.session.role,
    email: user.email,
    nickname: user.nickname,
  };
  next();
};
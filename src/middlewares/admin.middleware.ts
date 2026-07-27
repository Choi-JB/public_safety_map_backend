// 작성자 : 최정봉
// 내용: 관리자 권한 검증 미들웨어
import { Request, Response, NextFunction } from "express";

/**
 * 관리자 권한 검증 미들웨어
 * @param req - 요청 객체, session에 userId와 role이 있어야 함
 * @param res - 응답 객체
 * @param next - 다음 미들웨어 함수
 */
export const adminMiddleware = (
  req: Request & { session?: { userId?: string; role?: string } },
  res: Response,
  next: NextFunction
): void => {
  if (!req.session?.userId || req.session.role !== "ADMIN") {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  (req as any).admin = {
    id: req.session.userId,
    role: req.session.role,
  };
  next();
};
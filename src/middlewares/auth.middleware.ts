// 담당: 공통기반
import { Request, Response, NextFunction } from "express";

export const authMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // TODO: JWT 검증 구현 필요
  
  next();
};

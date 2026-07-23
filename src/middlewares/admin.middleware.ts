// 담당: 공통기반
import { Request, Response, NextFunction } from "express";

export const adminMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // TODO: role 체크 구현 필요
  next();
};

import { Request, Response, NextFunction } from "express";

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
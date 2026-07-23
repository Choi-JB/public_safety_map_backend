import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';

export const adminMiddleware: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError(403, 'FORBIDDEN', 'Admin role required'));
  }
  return next();
};

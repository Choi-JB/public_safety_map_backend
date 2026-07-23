import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../config/prismaClient.js';
import { AppError } from '../utils/errors.js';

export type AuthUser = {
  id: number;
  email: string | null;
  nickname: string | null;
  role: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
    }
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');
    }
    const user = await prisma.user.findUnique({ where: { id: BigInt(payload.sub as string | number) } });
    if (!user || user.isActive !== 'Y') {
      throw new AppError(401, 'UNAUTHORIZED', 'User inactive or not found');
    }
    req.user = {
      id: Number(user.id),
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    };
    return next();
  } catch (err) {
    return next(err);
  }
};

export const optionalAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return next();
  }
  return authMiddleware(req, res, next);
};

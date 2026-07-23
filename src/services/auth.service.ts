import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';

function validateSignup({ email, password, nickname }: { email?: string; password?: string; nickname?: string }) {
  if (!email || !password || !nickname) {
    throw new AppError(400, 'VALIDATION_ERROR', 'email, password, nickname are required');
  }
  if (String(email).length > 50) {
    throw new AppError(400, 'VALIDATION_ERROR', 'email maxLength 50');
  }
  if (String(nickname).length > 50) {
    throw new AppError(400, 'VALIDATION_ERROR', 'nickname maxLength 50');
  }
  if (String(password).length < 8 || String(password).length > 72) {
    throw new AppError(400, 'VALIDATION_ERROR', 'password length must be 8-72');
  }
}

export async function signup({
  email,
  password,
  nickname,
}: {
  email?: string;
  password?: string;
  nickname?: string;
}) {
  validateSignup({ email, password, nickname });
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');
  }
  const passwordHash = await bcrypt.hash(password!, 10);
  const user = await prisma.user.create({
    data: {
      email,
      nickname,
      passwordHash,
      role: 'NORMAL',
      isActive: 'Y',
      createdAt: new Date(),
    },
  });
  return {
    id: Number(user.id),
    email: user.email,
    nickname: user.nickname,
    role: user.role,
  };
}

export async function login({ email, password }: { email?: string; password?: string }) {
  if (!email || !password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'email and password are required');
  }
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new AppError(401, 'LOGIN_FAILED', 'Invalid email or password');
  }
  if (user.isActive === 'N') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Account is inactive');
  }
  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) {
    throw new AppError(401, 'LOGIN_FAILED', 'Invalid email or password');
  }
  const options: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  const accessToken = jwt.sign({ sub: Number(user.id), role: user.role }, config.jwt.secret, options);
  return {
    accessToken,
    user: {
      id: Number(user.id),
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    },
  };
}

// 담당: 공통기반
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient";

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LEN = 8;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = isNonEmptyString(req.body.email)
      ? req.body.email.trim()
      : "";
    const password = isNonEmptyString(req.body.password)
      ? req.body.password
      : "";
    if (!email || !password) {
      res.status(422).json({
        success: false,
        message: "email, password are required",
      });
      return;
    }
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || !user.password_hash) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }
    if (user.is_active !== "Y") {
      res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
      return;
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[login] JWT_SECRET is missing");
      res.status(500).json({ success: false, message: "Internal server error" });
      return;
    }
    // report.controller requireAuthUser: payload.sub | userId | id
    const access_token = jwt.sign(
      { role: user.role },
      secret,
      { subject: String(user.id), expiresIn: "7d" }
    );
    res.status(200).json({
      success: true,
      data: {
        access_token,
        user: {
          id: Number(user.id),
          nickname: user.nickname,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  // TODO: 구현 필요
  try {
    const email = isNonEmptyString(req.body.email)
      ? req.body.email.trim()
      : "";
    const password = isNonEmptyString(req.body.password)
      ? req.body.password
      : "";
    const nickname = isNonEmptyString(req.body.nickname)
      ? req.body.nickname.trim()
      : "";
    if (!email || !password || !nickname) {
      res.status(422).json({
        success: false,
        message: "email, password, nickname are required",
      });
      return;
    }
    if (email.length > 50 || nickname.length > 50) {
      res.status(422).json({
        success: false,
        message: "email/nickname too long",
      });
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      res.status(422).json({
        success: false,
        message: `password must be at least ${MIN_PASSWORD_LEN} characters`,
      });
      return;
    }
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, message: "Email already exists" });
      return;
    }
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        nickname,
        password_hash,
        role: "NORMAL", // 클라이언트 지정 불가
        is_active: "Y",
        created_at: new Date(),
      },
    });
    res.status(201).json({
      success: true,
      data: {
        id: Number(user.id),
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[signup]", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
//refresh 및 log out 기능 추가 필요시 수정
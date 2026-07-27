// 작성자 : 최정봉
// 내용 : 필수 환경변수 검증 — 하나라도 없으면 서버 시작을 막음

import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in .env`);
  }
  return value;
}

export const JWT_SECRET = requireEnv("JWT_SECRET");
export const SESSION_SECRET = requireEnv("SESSION_SECRET");
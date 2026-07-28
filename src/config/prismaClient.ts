// 담당: 공통기반
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

dotenv.config();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  // DATABASE_URL이 비어있거나 잘못되어도 앱 시작 시점에 죽지 않음.
  // 실제 연결은 쿼리 실행 시점에 발생함.
  let adapter: PrismaMariaDb;

  try {
    const url = new URL(databaseUrl);
    adapter = new PrismaMariaDb({
      host: url.hostname || "localhost",
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, "") || undefined,
    });
  } catch {
    // 잘못된 URL이어도 클라이언트 생성은 허용 (쿼리 시점에 실패)
    adapter = new PrismaMariaDb({
      host: "localhost",
      port: 3306,
      user: "",
      password: "",
      database: undefined,
      timezone: '+09:00',
    });
  }

  return new PrismaClient({ adapter });
}

const prismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export default prismaClient;

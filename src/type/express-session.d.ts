// types/express-session.d.ts
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: string;
    nickname?: string;
  }
}

declare namespace Express {
    interface Request {
      user?: { id: bigint; role: string | null };
    }
  }
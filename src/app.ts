// 담당: 공통기반
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import { SESSION_SECRET } from "./config/env";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import gridRoutes from "./routes/grid.routes";
import reportRoutes from "./routes/report.routes";
import feedbackRoutes from "./routes/feedback.routes";
import adminRoutes from "./routes/admin.routes";
import deviceRoutes from "./routes/device.routes";
import cityRoutes from "./routes/city.routes";  // 추가
import infraRoutes from "./routes/infra.routes";
import uploadRoutes from "./routes/upload.routes";
import mypageRoutes from "./routes/mypage.routes";
//사고 다발구역
import accidentZoneRoutes from "./routes/accidentZone.routes";
import notificationRoutes from "./routes/notification.routes";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT) || 4100;

app.use(cors(
  {
    origin: "http://localhost:3000", // 정확한 origin
    credentials: true, // 쿠키 허용
  }
));
app.use(express.json());
app.use(cookieParser()); //나중에 쿠키에서 refresh token 읽을 때 사용

app.use(session({  
  secret: SESSION_SECRET,  // 세션 데이터를 암호화하기 위한 키
  resave: false,  // 세션 데이터가 안 바뀌었을 때 스토어에 다시 저장할지 여부
  saveUninitialized: false,  // 세션 데이터가 초기화되지 않았을 때 스토어에 저장할지 여부
  rolling: true,    // 매 요청마다 세션 갱신
  cookie: {
    httpOnly: true,
    secure: true,      // 배포할 때는 true, 개발할 때는 false
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 2,   // 2시간 후 자동 만료
  },
  
}));

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/grids", gridRoutes);
app.use("/city-events", cityRoutes); // 추가
app.use("/infrastructures", infraRoutes);
app.use("/reports", reportRoutes);
app.use("/feedbacks", feedbackRoutes);
app.use("/admin", adminRoutes);
app.use("/devices", deviceRoutes);
app.use("/uploads", uploadRoutes);
app.use("/mypage", mypageRoutes);
app.use("/notification", notificationRoutes);
//사고 다발구역
app.use("/accident-zones", accidentZoneRoutes);
// 이미지 파일 정적 파일 서비스
app.use("/uploads", express.static(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  /**
   * 매일 00:00(Asia/Seoul) 안전등급 배치 스케줄 등록
   * - 서버가 살아 있는 동안만 동작 (프로세스 종료 시 cron 도 중단)
   * - 끄려면 .env 에 SCORE_CRON_ENABLED=false
   * - 동적 import: 스케줄 모듈 로드 실패해도 API 서버는 계속 기동
   */
  void import("./jobs/scoreScheduler")
    .then(({ startScoreCron }) => startScoreCron())
    .catch((err) => console.error("[score-cron] failed to start:", err));
});

export default app;

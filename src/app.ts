// 담당: 공통기반
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import gridRoutes from "./routes/grid.routes";
import reportRoutes from "./routes/report.routes";
import feedbackRoutes from "./routes/feedback.routes";
import adminRoutes from "./routes/admin.routes";
import deviceRoutes from "./routes/device.routes";
import cityRoutes from "./routes/city.routes";  // 추가


dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4100;

app.use(cors(
  {
    origin: "http://localhost:3000", // 정확한 origin
    credentials: true, // 쿠키 허용
  }
));
app.use(express.json());
app.use(session({   //"change-me" 나중에 배포 할때 변경해야함!!!!!
  secret: process.env.SESSION_SECRET || "change-me",  // 세션 데이터를 암호화하기 위한 키
  resave: false,  // 세션 데이터가 안 바뀌었을 때 스토어에 다시 저장할지 여부
  saveUninitialized: false,  // 세션 데이터가 초기화되지 않았을 때 스토어에 저장할지 여부
  rolling: true,    // 매 요청마다 세션 갱신
  cookie: {
    httpOnly: true,
    secure: false,      // 배포 HTTPS면 true
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 2,   // 2시간 후 자동 만료
  },
  
}));

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/grids", gridRoutes);
app.use("/city-events", cityRoutes); // 추가
app.use("/reports", reportRoutes);
app.use("/feedbacks", feedbackRoutes);
app.use("/admin", adminRoutes);
app.use("/devices", deviceRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;

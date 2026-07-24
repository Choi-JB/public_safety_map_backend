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
app.use(session({
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,      // 배포 HTTPS면 true
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8,
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

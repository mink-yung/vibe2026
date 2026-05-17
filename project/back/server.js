import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import personaRoutes from "./routes/personaRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import { testDbConnection } from "./config/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// 서버 확인용
app.get("/", (req, res) => {
  res.send("AI 면접 백엔드 서버 실행 중");
});

// API 연결
app.use("/api/auth", authRoutes);
app.use("/api/personas", personaRoutes);
app.use("/api/interviews", interviewRoutes);

app.use((err, req, res, next) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({
      success: false,
      message:
        "전송 데이터가 너무 큽니다. 영상·이미지 전체가 아닌 답변 텍스트와 분석 결과만 저장해 주세요.",
    });
  }
  next(err);
});

app.listen(PORT, async () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  await testDbConnection();
});

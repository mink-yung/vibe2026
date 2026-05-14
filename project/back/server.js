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
app.use(express.json());

// 서버 확인용
app.get("/", (req, res) => {
  res.send("AI 면접 백엔드 서버 실행 중");
});

// API 연결
app.use("/api/auth", authRoutes);
app.use("/api/personas", personaRoutes);
app.use("/api/interviews", interviewRoutes);

app.listen(PORT, async () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  await testDbConnection();
});
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

// 회원가입 API
// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "email, password, name이 필요합니다."
      });
    }

    // 이미 가입된 이메일인지 확인
    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "이미 가입된 이메일입니다."
      });
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // DB에 회원 저장
    const [result] = await pool.execute(
      "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
      [email, hashedPassword, name]
    );

    return res.status(201).json({
      success: true,
      message: "회원가입 성공",
      user: {
        id: result.insertId,
        email,
        name
      }
    });
  } catch (error) {
    console.error("회원가입 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 로그인 API
// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email과 password가 필요합니다."
      });
    }

    // 이메일로 사용자 찾기
    const [users] = await pool.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다."
      });
    }

    const user = users[0];

    // 비밀번호 비교
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다."
      });
    }

    // 로그인 토큰 생성
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

    return res.json({
      success: true,
      message: "로그인 성공",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error("로그인 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 내 정보 조회 API
// GET /api/auth/me
router.get("/me", authRequired, async (req, res) => {
    try {
      const [users] = await pool.execute(
        "SELECT id, email, name, created_at FROM users WHERE id = ?",
        [req.user.id]
      );
  
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다."
        });
      }
  
      return res.json({
        success: true,
        user: users[0]
      });
    } catch (error) {
      console.error("내 정보 조회 오류:", error);
  
      return res.status(500).json({
        success: false,
        message: "서버 오류가 발생했습니다."
      });
    }
  });

export default router;
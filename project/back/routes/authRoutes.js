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

// 내 정보 조회 API — 계정정보용 (이름·이메일·가입일만)
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

function trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// 상세정보 조회 API — 상세정보 탭 전용
// GET /api/auth/profile
router.get("/profile", authRequired, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT age, university, major, hobby, specialty,
              desired_position, career_level, skills, certifications,
              projects, experience, portfolio_url, github_url
         FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다."
      });
    }

    const r = rows[0];
    return res.json({
      success: true,
      profile: {
        age: r.age,
        university: r.university,
        major: r.major,
        hobby: r.hobby,
        specialty: r.specialty,
        desired_position: r.desired_position,
        career_level: r.career_level,
        skills: r.skills,
        certifications: r.certifications,
        projects: r.projects,
        experience: r.experience,
        portfolio_url: r.portfolio_url,
        github_url: r.github_url
      }
    });
  } catch (error) {
    console.error("상세정보 조회 오류:", error);

    if (error && error.code === "ER_BAD_FIELD_ERROR") {
      return res.status(503).json({
        success: false,
        message:
          "상세정보 컬럼이 DB에 없습니다. sql/add_user_profile_columns.sql 을 실행해 주세요."
      });
    }

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 상세정보 수정 API — 빈 문자열은 NULL, 나이만 비우면 NULL (부분 입력·부분 삭제 가능)
// PATCH /api/auth/profile
router.patch("/profile", authRequired, async (req, res) => {
  try {
    const b = req.body || {};
    let ageVal = null;
    if (b.age !== undefined && b.age !== null && String(b.age).trim() !== "") {
      const n = parseInt(String(b.age).trim(), 10);
      if (Number.isNaN(n) || n < 1 || n > 120) {
        return res.status(400).json({
          success: false,
          message: "나이는 1~120 사이 숫자로 입력해 주세요."
        });
      }
      ageVal = n;
    }

    await pool.execute(
      `UPDATE users SET
        age = ?, university = ?, major = ?, hobby = ?, specialty = ?,
        desired_position = ?, career_level = ?, skills = ?, certifications = ?,
        projects = ?, experience = ?, portfolio_url = ?, github_url = ?
      WHERE id = ?`,
      [
        ageVal,
        trimOrNull(b.university),
        trimOrNull(b.major),
        trimOrNull(b.hobby),
        trimOrNull(b.specialty),
        trimOrNull(b.desired_position),
        trimOrNull(b.career_level),
        trimOrNull(b.skills),
        trimOrNull(b.certifications),
        trimOrNull(b.projects),
        trimOrNull(b.experience),
        trimOrNull(b.portfolio_url),
        trimOrNull(b.github_url),
        req.user.id
      ]
    );

    return res.json({ success: true, message: "저장되었습니다." });
  } catch (error) {
    console.error("프로필 수정 오류:", error);

    return res.status(500).json({
      success: false,
      message:
        error && error.code === "ER_BAD_FIELD_ERROR"
          ? "DB에 상세정보 컬럼이 없습니다. sql/add_user_profile_columns.sql 을 실행해 주세요."
          : "서버 오류가 발생했습니다."
    });
  }
});

// 회원탈퇴 (연관 면접 데이터 삭제 후 사용자 삭제)
// DELETE /api/auth/account
router.delete("/account", authRequired, async (req, res) => {
  const userId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [interviewRows] = await conn.execute(
      "SELECT id FROM interviews WHERE user_id = ?",
      [userId]
    );
    const ids = interviewRows.map((r) => r.id);
    if (ids.length > 0) {
      const ph = ids.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM interview_feedbacks WHERE interview_id IN (${ph})`,
        ids
      );
    }
    await conn.execute(`DELETE FROM interviews WHERE user_id = ?`, [userId]);
    await conn.execute(`DELETE FROM users WHERE id = ?`, [userId]);
    await conn.commit();
    return res.json({
      success: true,
      message: "회원탈퇴가 완료되었습니다."
    });
  } catch (error) {
    await conn.rollback();
    console.error("회원탈퇴 오류:", error);
    return res.status(500).json({
      success: false,
      message: "탈퇴 처리 중 오류가 발생했습니다."
    });
  } finally {
    conn.release();
  }
});

export default router;
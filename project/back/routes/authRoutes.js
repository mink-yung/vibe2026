import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/authMiddleware.js";
import crypto from "crypto";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/mailService.js";

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function getFrontendLoginVerifiedUrl() {
  const base = (process.env.FRONTEND_PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}/login.html?verified=1`;
}

// 회원가입 API — users 저장 없음, pending + 인증 메일만
// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const name = String(req.body.name || "").trim();

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "email, password, name이 필요합니다."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "비밀번호는 8자 이상이어야 합니다."
      });
    }

    // 인증 완료된 계정만 중복 가입 불가
    const [verifiedUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ? AND email_verified = 1",
      [email]
    );

    if (verifiedUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "이미 가입된 이메일입니다."
      });
    }

    // 예전 방식으로 users에만 들어간 미인증 행이 있으면 제거 (pending 흐름으로 재가입 가능)
    await pool.execute(
      "DELETE FROM users WHERE email = ? AND (email_verified = 0 OR email_verified IS NULL)",
      [email]
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 30);

    await pool.execute(
      `INSERT INTO pending_email_verifications (
        email, password_hash, name, token_hash, expires_at
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        name = VALUES(name),
        token_hash = VALUES(token_hash),
        expires_at = VALUES(expires_at),
        created_at = CURRENT_TIMESTAMP`,
      [email, hashedPassword, name, tokenHash, expires]
    );

    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (mailError) {
      console.error("인증 메일 발송 실패:", mailError);
      await pool.execute(
        "DELETE FROM pending_email_verifications WHERE email = ?",
        [email]
      );
      return res.status(503).json({
        success: false,
        message:
          "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "회원가입 인증 메일을 보냈습니다. 메일의 링크를 눌러 인증을 완료한 뒤 로그인해 주세요."
    });
  } catch (error) {
    console.error("회원가입 오류:", error);

    if (error && error.code === "ER_NO_SUCH_TABLE") {
      return res.status(503).json({
        success: false,
        message:
          "이메일 인증 테이블이 없습니다. sql/pending_email_verifications.sql 을 실행해 주세요."
      });
    }

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
      const [pending] = await pool.execute(
        "SELECT email FROM pending_email_verifications WHERE email = ? AND expires_at > NOW()",
        [normalizeEmail(email)]
      );
      if (pending.length > 0) {
        return res.status(403).json({
          success: false,
          message:
            "이메일 인증이 완료되지 않았습니다. 받은 메일의 인증 링크를 눌러 주세요."
        });
      }
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다."
      });
    }

    const user = users[0];

    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message:
          "이메일 인증 후 로그인해 주세요. 인증 메일을 다시 받으려면 회원가입을 다시 진행해 주세요."
      });
    }

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

// 이메일 인증 API
// GET /api/auth/verify-email
router.get("/verify-email", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send("인증 토큰이 없습니다.");
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    await conn.beginTransaction();

    const [pendingRows] = await conn.execute(
      `SELECT id, email, password_hash, name
       FROM pending_email_verifications
       WHERE token_hash = ?
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );

    if (pendingRows.length === 0) {
      await conn.rollback();
      return res.status(400).send("인증 링크가 만료되었거나 올바르지 않습니다.");
    }

    const pending = pendingRows[0];

    const [existingUsers] = await conn.execute(
      "SELECT id FROM users WHERE email = ? AND email_verified = 1",
      [pending.email]
    );

    if (existingUsers.length > 0) {
      await conn.execute(
        "DELETE FROM pending_email_verifications WHERE id = ?",
        [pending.id]
      );
      await conn.commit();
      return res.redirect(getFrontendLoginVerifiedUrl());
    }

    await conn.execute(
      "DELETE FROM users WHERE email = ? AND (email_verified = 0 OR email_verified IS NULL)",
      [pending.email]
    );

    await conn.execute(
      `INSERT INTO users (email, password, name, email_verified)
       VALUES (?, ?, ?, 1)`,
      [pending.email, pending.password_hash, pending.name]
    );

    await conn.execute(
      "DELETE FROM pending_email_verifications WHERE id = ?",
      [pending.id]
    );

    await conn.commit();

    return res.redirect(getFrontendLoginVerifiedUrl());
  } catch (error) {
    await conn.rollback();
    console.error("이메일 인증 오류:", error);
    return res.status(500).send("이메일 인증 중 서버 오류가 발생했습니다.");
  } finally {
    conn.release();
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

const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "입력한 이메일로 비밀번호 재설정 안내를 보냈습니다. 메일함을 확인해주세요.";

// 비밀번호 찾기 — 이메일 존재 여부 노출하지 않음
// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.json({
        success: true,
        message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
      });
    }

    const [users] = await pool.execute(
      "SELECT id FROM users WHERE email = ? AND email_verified = 1",
      [email]
    );

    if (users.length === 0) {
      return res.json({
        success: true,
        message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
      });
    }

    const userId = users[0].id;
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 30);

    await pool.execute(
      "DELETE FROM password_reset_tokens WHERE user_id = ?",
      [userId]
    );
    await pool.execute(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [userId, tokenHash, expires]
    );

    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (mailError) {
      console.error("비밀번호 재설정 메일 발송 실패:", mailError);
    }

    return res.json({
      success: true,
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
    });
  } catch (error) {
    console.error("비밀번호 찾기 오류:", error);

    if (error && error.code === "ER_NO_SUCH_TABLE") {
      return res.status(503).json({
        success: false,
        message:
          "비밀번호 재설정 테이블이 없습니다. sql/password_reset_tokens.sql 을 실행해 주세요.",
      });
    }

    return res.json({
      success: true,
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
    });
  }
});

// 비밀번호 재설정
// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "token과 password가 필요합니다.",
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        success: false,
        message: "비밀번호는 4자 이상 입력해주세요.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    await conn.beginTransaction();

    const [tokenRows] = await conn.execute(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = ?
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "비밀번호 재설정 링크가 만료되었거나 올바르지 않습니다.",
      });
    }

    const row = tokenRows[0];
    const hashedPassword = await bcrypt.hash(String(password), 10);

    await conn.execute("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      row.user_id,
    ]);
    await conn.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [
      row.user_id,
    ]);

    await conn.commit();

    return res.json({
      success: true,
      message: "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.",
    });
  } catch (error) {
    await conn.rollback();
    console.error("비밀번호 재설정 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  } finally {
    conn.release();
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
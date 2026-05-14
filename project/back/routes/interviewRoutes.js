import express from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { generateInterviewFeedback } from "../services/aiService.js";

const router = express.Router();

// /api/interviews 로 시작하는 모든 API는 로그인 필요
router.use(authRequired);

// 아직 실제 AI 연결 전이라 mock 피드백 사용
const mockFeedbacks = {
  friendly: {
    feedback: `[좋았던 점]
답변에서 프로젝트 경험이 잘 드러났어요.

[보완하면 좋은 점]
다만 본인이 맡은 역할과 결과를 조금 더 구체적으로 말하면 좋아요.

[다음 질문]
그 프로젝트에서 본인이 직접 해결한 문제는 무엇이었나요?

[응원 메시지]
좋아요. 경험을 조금씩 구체화하면 훨씬 좋은 답변이 될 수 있어요.`,
    nextQuestion: "그 프로젝트에서 본인이 직접 해결한 문제는 무엇이었나요?"
  },

  sharp: {
    feedback: `[짧은 평가]
답변이 아직 평범합니다. 본인이 정확히 무엇을 했는지 판단할 근거가 부족합니다.

[꼬리 질문]
본인이 맡은 역할을 구체적으로 한 문장으로 설명해보세요.

[개선 방향]
막연한 표현보다 실제 행동과 결과를 중심으로 답변하세요.`,
    nextQuestion: "본인이 맡은 역할을 구체적으로 한 문장으로 설명해보세요."
  },

  pressure: {
    feedback: `[냉정한 평가]
답변이 추상적입니다. 실제 기여도를 판단하기 어렵습니다.

[압박 질문]
본인이 그 프로젝트에서 빠졌다면 결과가 달라졌을 만큼의 기여가 있었습니까?

[보완 요구]
역할, 행동, 결과를 구체적으로 말하세요.`,
    nextQuestion: "본인이 그 프로젝트에서 빠졌다면 결과가 달라졌을 만큼의 기여가 있었습니까?"
  }
};

// 빠른면접 - 친절 페르소나 자동 사용
// POST /api/interviews/quick
router.post("/quick", async (req, res) => {
  try {
    const { answerText } = req.body;
    const userId = req.user.id;

    if (!answerText) {
      return res.status(400).json({
        success: false,
        message: "answerText가 필요합니다."
      });
    }

    const aiResult = await generateInterviewFeedback({
      persona: "friendly",
      questionText: null,
      answerText
    });
    
    const feedbackData = {
      feedback: aiResult.feedback,
      nextQuestion: aiResult.nextQuestion
    };
    
    const summary = aiResult.summary;
    const overallScore = aiResult.overallScore;

    const [interviewResult] = await pool.execute(
      `INSERT INTO interviews 
       (user_id, mode, question_text, answer_text, summary, overall_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "quick", null, answerText, summary, overallScore]
    );

    const interviewId = interviewResult.insertId;

    await pool.execute(
      `INSERT INTO interview_feedbacks
       (interview_id, persona, feedback, next_question)
       VALUES (?, ?, ?, ?)`,
      [interviewId, "friendly", feedbackData.feedback, feedbackData.nextQuestion]
    );

    return res.status(201).json({
      success: true,
      interviewId,
      mode: "quick",
      persona: "friendly",
      answerText,
      feedback: feedbackData.feedback,
      nextQuestion: feedbackData.nextQuestion,
      summary,
      overallScore
    });
  } catch (error) {
    console.error("빠른면접 저장 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 기본면접 - 친절 페르소나 자동 사용
// POST /api/interviews/basic
router.post("/basic", async (req, res) => {
  try {
    const { questionText, answerText } = req.body;
    const userId = req.user.id;

    if (!questionText || !answerText) {
      return res.status(400).json({
        success: false,
        message: "questionText와 answerText가 필요합니다."
      });
    }

    const aiResult = await generateInterviewFeedback({
      persona: "friendly",
      questionText,
      answerText
    });
    
    const feedbackData = {
      feedback: aiResult.feedback,
      nextQuestion: aiResult.nextQuestion
    };
    
    const summary = aiResult.summary;
    const overallScore = aiResult.overallScore;

    const [interviewResult] = await pool.execute(
      `INSERT INTO interviews 
       (user_id, mode, question_text, answer_text, summary, overall_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "basic", questionText, answerText, summary, overallScore]
    );

    const interviewId = interviewResult.insertId;

    await pool.execute(
      `INSERT INTO interview_feedbacks
       (interview_id, persona, feedback, next_question)
       VALUES (?, ?, ?, ?)`,
      [interviewId, "friendly", feedbackData.feedback, feedbackData.nextQuestion]
    );

    return res.status(201).json({
      success: true,
      interviewId,
      mode: "basic",
      persona: "friendly",
      questionText,
      answerText,
      feedback: feedbackData.feedback,
      nextQuestion: feedbackData.nextQuestion,
      summary,
      overallScore
    });
  } catch (error) {
    console.error("기본면접 저장 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 실전면접 - 친절, 까칠, 압박 3명 모두 사용
// POST /api/interviews/real
router.post("/real", async (req, res) => {
  try {
    const { questionText, answerText } = req.body;
    const userId = req.user.id;

    if (!questionText || !answerText) {
      return res.status(400).json({
        success: false,
        message: "questionText와 answerText가 필요합니다."
      });
    }

    const friendlyResult = await generateInterviewFeedback({
      persona: "friendly",
      questionText,
      answerText
    });
    
    const sharpResult = await generateInterviewFeedback({
      persona: "sharp",
      questionText,
      answerText
    });
    
    const pressureResult = await generateInterviewFeedback({
      persona: "pressure",
      questionText,
      answerText
    });
    
    const summary = friendlyResult.summary;
    const overallScore = Math.round(
      (friendlyResult.overallScore + sharpResult.overallScore + pressureResult.overallScore) / 3
    );
    
    const feedbacks = [
      {
        persona: "friendly",
        name: "친절한 면접관",
        feedback: friendlyResult.feedback,
        nextQuestion: friendlyResult.nextQuestion
      },
      {
        persona: "sharp",
        name: "까칠한 면접관",
        feedback: sharpResult.feedback,
        nextQuestion: sharpResult.nextQuestion
      },
      {
        persona: "pressure",
        name: "압박 면접관",
        feedback: pressureResult.feedback,
        nextQuestion: pressureResult.nextQuestion
      }
    ];

    const [interviewResult] = await pool.execute(
      `INSERT INTO interviews 
       (user_id, mode, question_text, answer_text, summary, overall_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "real", questionText, answerText, summary, overallScore]
    );

    const interviewId = interviewResult.insertId;

    for (const item of feedbacks) {
      await pool.execute(
        `INSERT INTO interview_feedbacks
         (interview_id, persona, feedback, next_question)
         VALUES (?, ?, ?, ?)`,
        [interviewId, item.persona, item.feedback, item.nextQuestion]
      );
    }

    return res.status(201).json({
      success: true,
      interviewId,
      mode: "real",
      questionText,
      answerText,
      feedbacks,
      summary,
      overallScore
    });
  } catch (error) {
    console.error("실전면접 저장 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 면접 기록 조회
// GET /api/interviews/history
router.get("/history", async (req, res) => {
  try {
    const userId = req.user.id;

    const [history] = await pool.execute(
      `SELECT 
        id AS interviewId,
        mode,
        question_text AS questionText,
        answer_text AS answerText,
        summary,
        overall_score AS overallScore,
        created_at AS createdAt
       FROM interviews
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error("면접 기록 조회 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      error: error.message
    });
  }
});

// 최근 면접 분석 조회
// GET /api/interviews/recent/analysis
router.get("/recent/analysis", async (req, res) => {
  try {
    const userId = req.user.id;

    const [interviews] = await pool.execute(
      `SELECT 
        id AS interviewId,
        mode,
        question_text AS questionText,
        answer_text AS answerText,
        summary,
        overall_score AS overallScore,
        created_at AS createdAt
       FROM interviews
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (interviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: "최근 면접 기록이 없습니다."
      });
    }

    const recent = interviews[0];

    return res.json({
      success: true,
      interviewId: recent.interviewId,
      analysis: {
        mode: recent.mode,
        overallScore: recent.overallScore,
        strengths: ["직무 경험을 언급함", "본인의 역할을 설명함"],
        weaknesses: ["성과가 구체적이지 않음", "수치나 결과 설명이 부족함"],
        recommendation: recent.summary,
        createdAt: recent.createdAt
      }
    });
  } catch (error) {
    console.error("최근 면접 분석 조회 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// AI 피드백 요약 조회
// GET /api/interviews/recent/summary
router.get("/recent/summary", async (req, res) => {
  try {
    const userId = req.user.id;

    const [interviews] = await pool.execute(
      `SELECT 
        id AS interviewId,
        summary,
        created_at AS createdAt
       FROM interviews
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (interviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: "최근 면접 기록이 없습니다."
      });
    }

    return res.json({
      success: true,
      interviewId: interviews[0].interviewId,
      summary: interviews[0].summary,
      createdAt: interviews[0].createdAt
    });
  } catch (error) {
    console.error("최근 피드백 요약 조회 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

export default router;
import express from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  generateInterviewFeedback,
  generateCameraAnalysis,
  generateCameraInterviewEvaluation,
  buildSessionAudioMetrics,
} from "../services/aiService.js";
import { appLog, appLogError } from "../utils/appLog.js";

const PLACEHOLDER_ANSWER_MARKERS = [
  "STT는 추후",
  "음성 인식 미연동",
  "기본 면접 답변",
  "실전 면접 답변",
  "추후 연동 예정",
  "기본 면접 화면에서 제출",
];

function normalizeAnswerText(body) {
  const raw = body?.answerText ?? body?.transcript ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function isPlaceholderAnswer(text) {
  if (!text) return true;
  return PLACEHOLDER_ANSWER_MARKERS.some((m) => text.includes(m));
}

async function saveCameraInterviewExtras({
  interviewId,
  userId,
  mode,
  questionText,
  answerText,
  cameraAnalysis: cameraAnalysisInput,
  durationSeconds,
  volumeSamples,
}) {
  const safeVolume = Array.isArray(volumeSamples)
    ? volumeSamples.slice(-60).map((v) => Number(v) || 0)
    : [];

  let cameraAnalysis = null;
  if (cameraAnalysisInput && typeof cameraAnalysisInput === "object" && !Array.isArray(cameraAnalysisInput)) {
    cameraAnalysis = cameraAnalysisInput;
  } else {
    cameraAnalysis = buildSessionAudioMetrics({
      transcript: answerText,
      durationSeconds,
      volumeSamples: safeVolume,
    });
  }

  const evaluation = await generateCameraInterviewEvaluation({
    mode,
    questionText,
    answerText,
    cameraAnalysis,
    speakingSpeed: cameraAnalysis?.speakingSpeed,
    intonation: cameraAnalysis?.intonation,
  });

  appLog("camera interview scores parsed", {
    interviewId,
    scores: evaluation.scores,
  });

  const metrics = {
    scores: evaluation.scores,
    delivery: evaluation.deliveryMetrics,
    content: evaluation.contentMetrics,
    competency: evaluation.competencyMetrics,
    feedback: evaluation.feedback,
  };

  await pool.execute(
    `UPDATE interviews
     SET camera_analysis_json = ?,
         metrics_json = ?,
         summary = ?,
         overall_score = ?
     WHERE id = ?
       AND user_id = ?`,
    [
      cameraAnalysis ? JSON.stringify(cameraAnalysis) : null,
      JSON.stringify(metrics),
      evaluation.summary,
      evaluation.overallScore,
      interviewId,
      userId,
    ]
  );

  return { cameraAnalysis, evaluation, metrics };
}

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

// 빠른면접 음성 결과 저장
// POST /api/interviews/quick/audio
router.post("/quick/audio", async (req, res) => {
  try {
    const { questionText, answerText, transcript } = req.body;
    const userId = req.user.id;

    const finalAnswerText = answerText || transcript;

    if (!finalAnswerText) {
      return res.status(400).json({
        success: false,
        message: "answerText 또는 transcript가 필요합니다."
      });
    }

    const aiResult = await generateInterviewFeedback({
      persona: "friendly",
      questionText: questionText || null,
      answerText: finalAnswerText
    });

    const summary = aiResult.summary;
    const overallScore = aiResult.overallScore;

    const [interviewResult] = await pool.execute(
      `INSERT INTO interviews 
       (user_id, mode, question_text, answer_text, summary, overall_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "quick_audio", questionText || null, finalAnswerText, summary, overallScore]
    );

    const interviewId = interviewResult.insertId;

    await pool.execute(
      `INSERT INTO interview_feedbacks
       (interview_id, persona, feedback, next_question)
       VALUES (?, ?, ?, ?)`,
      [interviewId, "friendly", aiResult.feedback, aiResult.nextQuestion]
    );

    return res.status(201).json({
      success: true,
      interviewId,
      mode: "quick_audio",
      persona: "friendly",
      questionText: questionText || null,
      answerText: finalAnswerText,
      transcript: finalAnswerText,
      feedback: aiResult.feedback,
      nextQuestion: aiResult.nextQuestion,
      summary,
      overallScore
    });
  } catch (error) {
    console.error("빠른면접 음성 저장 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      error: error.message
    });
  }
});

// 기본면접 - 친절 페르소나 자동 사용
// POST /api/interviews/basic
router.post("/basic", async (req, res) => {
  try {
    const { questionText, durationSeconds, volumeSamples, cameraAnalysis, interviewType } =
      req.body;
    const userId = req.user.id;
    const finalAnswerText = normalizeAnswerText(req.body);

    console.log("[camera save] user:", userId);
    console.log("[camera save] question:", questionText?.slice?.(0, 80));
    console.log("[camera save] answer length:", finalAnswerText.length);
    console.log("[camera save] interviewType:", interviewType || "basic");
    console.log("[camera save] cameraAnalysis exists:", !!cameraAnalysis);

    appLog("POST /basic", {
      answerLen: finalAnswerText.length,
      interviewType: interviewType || "camera",
    });

    if (!questionText || !String(questionText).trim()) {
      return res.status(400).json({
        success: false,
        message: "questionText가 필요합니다.",
      });
    }

    if (!finalAnswerText) {
      return res.status(400).json({
        success: false,
        message: "답변 내용이 없어 저장할 수 없습니다.",
      });
    }

    if (isPlaceholderAnswer(finalAnswerText)) {
      return res.status(400).json({
        success: false,
        message:
          "답변 텍스트가 비어 있거나 인식되지 않았습니다. 다시 답변해 주세요.",
      });
    }

    const aiResult = await generateInterviewFeedback({
      persona: "friendly",
      questionText,
      answerText: finalAnswerText,
    });

    const [interviewResult] = await pool.execute(
      `INSERT INTO interviews 
       (user_id, mode, question_text, answer_text, summary, overall_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        "basic",
        questionText,
        finalAnswerText,
        aiResult.summary,
        aiResult.overallScore,
      ]
    );

    const interviewId = interviewResult.insertId;

    await pool.execute(
      `INSERT INTO interview_feedbacks
       (interview_id, persona, feedback, next_question)
       VALUES (?, ?, ?, ?)`,
      [interviewId, "friendly", aiResult.feedback, aiResult.nextQuestion]
    );

    const { evaluation, metrics, cameraAnalysis: savedCameraAnalysis } =
      await saveCameraInterviewExtras({
        interviewId,
        userId,
        mode: "basic",
        questionText,
        answerText: finalAnswerText,
        cameraAnalysis,
        durationSeconds,
        volumeSamples,
      });

    console.log("[camera save] scores:", evaluation.scores);
    appLog("basic interview saved", { interviewId, overallScore: evaluation.overallScore });

    return res.status(201).json({
      success: true,
      interviewId,
      mode: "basic",
      persona: "friendly",
      questionText,
      answerText: finalAnswerText,
      feedback: evaluation.feedback?.overall || aiResult.feedback,
      nextQuestion: aiResult.nextQuestion,
      summary: evaluation.summary,
      overallScore: evaluation.overallScore,
      scores: evaluation.scores,
      metrics,
      cameraAnalysis: savedCameraAnalysis,
      feedbackDetail: evaluation.feedback,
    });
  } catch (error) {
    console.error("[camera save] basic error:", error);
    appLogError("기본면접 저장 오류", { message: error.message });

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
});

// 기본면접 음성 결과 저장
// POST /api/interviews/basic/audio
router.post("/basic/audio", async (req, res) => {
  try {
    const { questionText, answerText, transcript } = req.body;
    const userId = req.user.id;

    const finalAnswerText = answerText || transcript;

    if (!questionText || !finalAnswerText) {
      return res.status(400).json({
        success: false,
        message: "questionText와 answerText 또는 transcript가 필요합니다."
      });
    }

    const aiResult = await generateInterviewFeedback({
      persona: "friendly",
      questionText,
      answerText: finalAnswerText
    });

    const summary = aiResult.summary;
    const overallScore = aiResult.overallScore;

    const [interviewResult] = await pool.execute(
      `INSERT INTO interviews 
       (user_id, mode, question_text, answer_text, summary, overall_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "basic_audio", questionText, finalAnswerText, summary, overallScore]
    );

    const interviewId = interviewResult.insertId;

    await pool.execute(
      `INSERT INTO interview_feedbacks
       (interview_id, persona, feedback, next_question)
       VALUES (?, ?, ?, ?)`,
      [interviewId, "friendly", aiResult.feedback, aiResult.nextQuestion]
    );

    return res.status(201).json({
      success: true,
      interviewId,
      mode: "basic_audio",
      persona: "friendly",
      questionText,
      answerText: finalAnswerText,
      transcript: finalAnswerText,
      feedback: aiResult.feedback,
      nextQuestion: aiResult.nextQuestion,
      summary,
      overallScore
    });
  } catch (error) {
    console.error("기본면접 음성 저장 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      error: error.message
    });
  }
});

// 실전면접 - 친절, 까칠, 압박 3명 모두 사용
// POST /api/interviews/real
router.post("/real", async (req, res) => {
  try {
    const { questionText, durationSeconds, volumeSamples, cameraAnalysis, interviewType } =
      req.body;
    const userId = req.user.id;
    const finalAnswerText = normalizeAnswerText(req.body);

    console.log("[camera save] user:", userId);
    console.log("[camera save] question:", questionText?.slice?.(0, 80));
    console.log("[camera save] answer length:", finalAnswerText.length);
    console.log("[camera save] interviewType:", interviewType || "real");
    console.log("[camera save] cameraAnalysis exists:", !!cameraAnalysis);

    appLog("POST /real", {
      answerLen: finalAnswerText.length,
      interviewType: interviewType || "camera",
    });

    if (!questionText || !String(questionText).trim()) {
      return res.status(400).json({
        success: false,
        message: "questionText가 필요합니다.",
      });
    }

    if (!finalAnswerText) {
      return res.status(400).json({
        success: false,
        message: "답변 내용이 없어 저장할 수 없습니다.",
      });
    }

    if (isPlaceholderAnswer(finalAnswerText)) {
      return res.status(400).json({
        success: false,
        message:
          "답변 텍스트가 비어 있거나 인식되지 않았습니다. 다시 답변해 주세요.",
      });
    }

    const friendlyResult = await generateInterviewFeedback({
      persona: "friendly",
      questionText,
      answerText: finalAnswerText,
    });

    const sharpResult = await generateInterviewFeedback({
      persona: "sharp",
      questionText,
      answerText: finalAnswerText,
    });

    const pressureResult = await generateInterviewFeedback({
      persona: "pressure",
      questionText,
      answerText: finalAnswerText,
    });

    const feedbacks = [
      {
        persona: "friendly",
        name: "친절한 면접관",
        feedback: friendlyResult.feedback,
        nextQuestion: friendlyResult.nextQuestion,
      },
      {
        persona: "sharp",
        name: "까칠한 면접관",
        feedback: sharpResult.feedback,
        nextQuestion: sharpResult.nextQuestion,
      },
      {
        persona: "pressure",
        name: "압박 면접관",
        feedback: pressureResult.feedback,
        nextQuestion: pressureResult.nextQuestion,
      },
    ];

    const personaAvg = Math.round(
      (friendlyResult.overallScore +
        sharpResult.overallScore +
        pressureResult.overallScore) /
        3
    );

    const [interviewResult] = await pool.execute(
      `INSERT INTO interviews 
       (user_id, mode, question_text, answer_text, summary, overall_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        "real",
        questionText,
        finalAnswerText,
        friendlyResult.summary,
        personaAvg,
      ]
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

    const { evaluation, metrics, cameraAnalysis: savedCameraAnalysis } =
      await saveCameraInterviewExtras({
        interviewId,
        userId,
        mode: "real",
        questionText,
        answerText: finalAnswerText,
        cameraAnalysis,
        durationSeconds,
        volumeSamples,
      });

    console.log("[camera save] scores:", evaluation.scores);
    appLog("real interview saved", { interviewId, overallScore: evaluation.overallScore });

    return res.status(201).json({
      success: true,
      interviewId,
      mode: "real",
      questionText,
      answerText: finalAnswerText,
      feedbacks,
      summary: evaluation.summary,
      overallScore: evaluation.overallScore,
      scores: evaluation.scores,
      metrics,
      cameraAnalysis: savedCameraAnalysis,
      feedbackDetail: evaluation.feedback,
    });
  } catch (error) {
    console.error("[camera save] real error:", error);
    appLogError("실전면접 저장 오류", { message: error.message });

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
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

// 카메라 AI 분석 저장
// POST /api/interviews/camera/analyze
router.post("/camera/analyze", async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      interviewId,
      mode,
      images,
      transcript,
      durationSeconds,
      volumeSamples
    } = req.body;

    if (!interviewId) {
      return res.status(400).json({
        success: false,
        message: "interviewId가 필요합니다."
      });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "분석할 카메라 이미지가 필요합니다."
      });
    }

    const [interviews] = await pool.execute(
      `SELECT id, user_id, mode
       FROM interviews
       WHERE id = ?
         AND user_id = ?`,
      [interviewId, userId]
    );

    if (interviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: "면접 기록을 찾을 수 없습니다."
      });
    }

    const safeImages = images.slice(0, 3);

    const cameraAnalysis = await generateCameraAnalysis({
      mode: mode || interviews[0].mode,
      images: safeImages,
      transcript,
      durationSeconds,
      volumeSamples
    });

    const metrics = {
      expression: cameraAnalysis.expression,
      intonation: cameraAnalysis.intonation,
      postureStability: cameraAnalysis.postureStability,
      speakingSpeed: cameraAnalysis.speakingSpeed,
      eyeContact: cameraAnalysis.eyeContact
    };

    await pool.execute(
      `UPDATE interviews
       SET camera_analysis_json = ?,
           metrics_json = ?
       WHERE id = ?
         AND user_id = ?`,
      [
        JSON.stringify(cameraAnalysis),
        JSON.stringify(metrics),
        interviewId,
        userId
      ]
    );

    return res.json({
      success: true,
      interviewId: Number(interviewId),
      mode: mode || interviews[0].mode,
      cameraAnalysis,
      metrics
    });
  } catch (error) {
    console.error("카메라 분석 저장 오류:", error);

    return res.status(500).json({
      success: false,
      message: "카메라 분석 중 서버 오류가 발생했습니다.",
      error: error.message
    });
  }
});

// 특정 면접 상세 조회
// GET /api/interviews/:interviewId
router.get("/:interviewId", async (req, res) => {
  try {
    const userId = req.user.id;
    const { interviewId } = req.params;

    const [interviews] = await pool.execute(
      `SELECT 
        id AS interviewId,
        mode,
        question_text AS questionText,
        answer_text AS answerText,
        summary,
        overall_score AS overallScore,
        camera_analysis_json AS cameraAnalysisJson,
        metrics_json AS metricsJson,
        created_at AS createdAt
       FROM interviews
       WHERE id = ?
         AND user_id = ?`,
      [interviewId, userId]
    );

    if (interviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: "면접 기록을 찾을 수 없습니다."
      });
    }

    const [feedbacks] = await pool.execute(
      `SELECT
        id AS feedbackId,
        persona,
        feedback,
        next_question AS nextQuestion,
        created_at AS createdAt
       FROM interview_feedbacks
       WHERE interview_id = ?
       ORDER BY id ASC`,
      [interviewId]
    );

    const interview = interviews[0];

    return res.json({
      success: true,
      interview: {
        ...interview,
        cameraAnalysis: interview.cameraAnalysisJson
          ? JSON.parse(interview.cameraAnalysisJson)
          : null,
        metrics: interview.metricsJson
          ? JSON.parse(interview.metricsJson)
          : null,
        feedbacks
      }
    });
  } catch (error) {
    console.error("면접 상세 조회 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      error: error.message
    });
  }
});

// 특정 면접 기록 삭제
// DELETE /api/interviews/:interviewId
router.delete("/:interviewId", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const { interviewId } = req.params;

    if (!interviewId || isNaN(Number(interviewId))) {
      connection.release();

      return res.status(400).json({
        success: false,
        message: "올바른 interviewId가 필요합니다."
      });
    }

    await connection.beginTransaction();

    const [interviews] = await connection.execute(
      `SELECT id
       FROM interviews
       WHERE id = ?
         AND user_id = ?`,
      [interviewId, userId]
    );

    if (interviews.length === 0) {
      await connection.rollback();
      connection.release();

      return res.status(404).json({
        success: false,
        message: "삭제할 면접 기록을 찾을 수 없습니다."
      });
    }

    await connection.execute(
      `DELETE FROM interview_feedbacks
       WHERE interview_id = ?`,
      [interviewId]
    );

    await connection.execute(
      `DELETE FROM interviews
       WHERE id = ?
         AND user_id = ?`,
      [interviewId, userId]
    );

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      message: "면접 기록이 삭제되었습니다.",
      deletedInterviewId: Number(interviewId)
    });
  } catch (error) {
    await connection.rollback();
    connection.release();

    console.error("면접 기록 삭제 오류:", error);

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      error: error.message
    });
  }
});

export default router;
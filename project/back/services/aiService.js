import dotenv from "dotenv";
import OpenAI from "openai";
import { personaPrompts } from "../data/personaPrompts.js";

dotenv.config();

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

const systemPrompt = `
너는 면접 피드백을 제공하는 AI 면접관이다.

중요 규칙:
- 사용자의 답변은 한국어, 영어 또는 다른 언어일 수 있다.
- 답변 언어와 상관없이 의미를 이해해서 평가한다.
- 피드백, 요약, 다음 질문은 항상 한국어로 작성한다.
- 번역만 하지 말고 면접 답변으로서 내용, 구체성, 논리성, 직무 관련성을 평가한다.
- 답변이 짧거나 부족하면 부족한 이유를 친절하지만 명확하게 설명한다.
- 반드시 JSON 형식으로만 응답한다.
`;

function getFallbackFeedback({ persona, questionText, answerText, reason }) {
  const safeAnswer = answerText || "";
  const answerLength = safeAnswer.trim().length;

  let personaLabel = "친절한 면접관";
  let tone = "친절하게";

  if (persona === "sharp") {
    personaLabel = "까칠한 면접관";
    tone = "직설적으로";
  }

  if (persona === "pressure") {
    personaLabel = "압박 면접관";
    tone = "냉정하게";
  }

  const score = answerLength < 20 ? 45 : answerLength < 80 ? 65 : 75;

  return {
    feedback: `[${personaLabel} 피드백]

[좋았던 점]
답변에서 지원자의 경험이나 생각을 확인할 수 있었습니다.

[보완하면 좋은 점]
답변이 조금 더 구체적이면 좋습니다. 단순히 무엇을 했는지만 말하기보다, 어떤 상황에서 어떤 역할을 맡았고, 어떤 문제를 해결했으며, 결과가 어땠는지까지 설명하면 더 좋은 면접 답변이 됩니다.

[개선 방향]
${tone} 말하면, 답변에는 상황, 행동, 결과가 함께 들어가야 합니다. 특히 프로젝트나 경험을 말할 때는 본인의 기여도를 분명히 드러내는 것이 중요합니다.

[안내]
현재 AI 호출에 실패하여 임시 피드백으로 대체되었습니다. 사유: ${reason || "알 수 없음"}`,
    nextQuestion:
      questionText
        ? "방금 답변에서 본인이 직접 기여한 부분을 더 구체적으로 설명해주시겠어요?"
        : "그 경험에서 본인이 직접 해결한 문제는 무엇이었나요?",
    summary:
      "AI 호출 실패로 임시 피드백이 제공되었습니다. 답변은 저장되었으며, 구체적인 역할·과정·결과를 보완하면 더 좋은 답변이 됩니다.",
    overallScore: score,
  };
}

function extractJsonText(text) {
  if (!text) return "";

  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function generateInterviewFeedback({
  persona,
  questionText,
  answerText,
}) {
  const personaPrompt = personaPrompts[persona];

  if (!personaPrompt) {
    return getFallbackFeedback({
      persona,
      questionText,
      answerText,
      reason: "존재하지 않는 페르소나입니다.",
    });
  }

  if (!client) {
    return getFallbackFeedback({
      persona,
      questionText,
      answerText,
      reason: "OPENAI_API_KEY가 .env에 없습니다.",
    });
  }

  const input = `
${systemPrompt}

${personaPrompt}

면접 질문:
${questionText || "질문 없음. 사용자의 답변만 보고 피드백한다."}

지원자의 답변:
${answerText}

위 답변을 면접관 페르소나에 맞게 평가해라.

반드시 아래 JSON 형식으로만 응답해라.
설명 문장이나 마크다운 코드블록은 넣지 마라.

{
  "feedback": "면접관의 전체 피드백",
  "nextQuestion": "다음 꼬리 질문 1개",
  "summary": "피드백 요약 1~2문장",
  "overallScore": 0부터 100 사이의 숫자
}
`;

  try {
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input,
    });

    const text = response.output_text;
    const jsonText = extractJsonText(text);

    try {
      const parsed = JSON.parse(jsonText);

      return {
        feedback: parsed.feedback || "피드백을 생성하지 못했습니다.",
        nextQuestion:
          parsed.nextQuestion || "답변을 조금 더 구체적으로 설명해주시겠어요?",
        summary: parsed.summary || "피드백 요약을 생성하지 못했습니다.",
        overallScore:
          typeof parsed.overallScore === "number" ? parsed.overallScore : 70,
      };
    } catch (parseError) {
      console.error("AI 응답 JSON 파싱 실패:", text);

      return {
        feedback: text || "AI 응답을 파싱하지 못했습니다.",
        nextQuestion: "답변을 조금 더 구체적으로 설명해주시겠어요?",
        summary:
          "AI 응답을 JSON으로 파싱하지 못해 전체 응답을 피드백으로 저장했습니다.",
        overallScore: 70,
      };
    }
  } catch (error) {
    console.error("OpenAI 호출 실패:", error.message);

    return getFallbackFeedback({
      persona,
      questionText,
      answerText,
      reason: error.message,
    });
  }
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function buildSessionAudioMetrics({ transcript, durationSeconds, volumeSamples }) {
  return {
    speakingSpeed: calculateSpeakingSpeedScore({ transcript, durationSeconds }),
    intonation: calculateIntonationScore({ volumeSamples }),
  };
}

function calculateSpeakingSpeedScore({ transcript, durationSeconds }) {
  if (!transcript || !durationSeconds || durationSeconds <= 0) {
    return 70;
  }

  const textLength = transcript.replace(/\s/g, "").length;
  const charsPerSecond = textLength / durationSeconds;

  // 한국어 면접 답변 기준 대략적인 말하기 속도 평가
  if (charsPerSecond >= 2.5 && charsPerSecond <= 4.5) {
    return 90;
  }

  if (charsPerSecond >= 1.8 && charsPerSecond < 2.5) {
    return 78;
  }

  if (charsPerSecond > 4.5 && charsPerSecond <= 5.5) {
    return 76;
  }

  if (charsPerSecond < 1.8) {
    return 60;
  }

  return 58;
}

function calculateIntonationScore({ volumeSamples }) {
  if (!Array.isArray(volumeSamples) || volumeSamples.length < 5) {
    return 70;
  }

  const numbers = volumeSamples.map((v) => Number(v) || 0);

  const avg =
    numbers.reduce((sum, value) => sum + value, 0) / numbers.length;

  const variance =
    numbers.reduce((sum, value) => {
      const diff = value - avg;
      return sum + diff * diff;
    }, 0) / numbers.length;

  const stdDev = Math.sqrt(variance);

  // 볼륨 변화가 적당하면 억양 변화가 있다고 간이 판단
  if (stdDev >= 0.04 && stdDev <= 0.14) {
    return 88;
  }

  if (stdDev >= 0.02 && stdDev < 0.04) {
    return 74;
  }

  if (stdDev > 0.14 && stdDev <= 0.22) {
    return 72;
  }

  return 60;
}

function getCameraFallbackAnalysis({
  transcript,
  durationSeconds,
  volumeSamples,
  reason,
}) {
  return {
    expression: 70,
    eyeContact: 70,
    postureStability: 70,
    speakingSpeed: calculateSpeakingSpeedScore({
      transcript,
      durationSeconds,
    }),
    intonation: calculateIntonationScore({
      volumeSamples,
    }),
    summary: "카메라 AI 분석 호출 실패로 기본 분석 결과가 제공되었습니다.",
    feedback: `카메라 분석을 완료하지 못했습니다. 면접 연습에서는 카메라 정면을 보고, 안정적인 자세를 유지하며, 답변 속도와 목소리 변화를 일정하게 유지하는 것이 중요합니다. 실패 사유: ${
      reason || "알 수 없음"
    }`,
  };
}

export async function generateCameraAnalysis({
  mode,
  images,
  transcript,
  durationSeconds,
  volumeSamples,
}) {
  if (!client) {
    return getCameraFallbackAnalysis({
      transcript,
      durationSeconds,
      volumeSamples,
      reason: "OPENAI_API_KEY가 없습니다.",
    });
  }

  const safeImages = Array.isArray(images) ? images.slice(0, 3) : [];

  if (safeImages.length === 0) {
    return getCameraFallbackAnalysis({
      transcript,
      durationSeconds,
      volumeSamples,
      reason: "분석할 이미지가 없습니다.",
    });
  }

  const speakingSpeed = calculateSpeakingSpeedScore({
    transcript,
    durationSeconds,
  });

  const intonation = calculateIntonationScore({
    volumeSamples,
  });

  const prompt = `
너는 AI 면접 연습 서비스의 카메라 분석 도우미다.

분석 목적:
- 면접 연습 참고용으로만 분석한다.
- 사람의 감정, 성격, 건강 상태를 단정하지 않는다.
- 화면상 관찰 가능한 요소만 평가한다.
- 피드백은 반드시 한국어로 작성한다.

이미지를 보고 아래 항목을 0~100점으로 평가해라.

평가 항목:
1. expression: 표정
2. eyeContact: 시선
3. postureStability: 자세안정성

주의:
- "슬퍼 보인다", "불안하다"처럼 감정이나 심리 상태를 단정하지 마라.
- "화면상 관찰 기준", "참고용 분석"이라는 표현을 사용해라.
- speakingSpeed와 intonation은 서버에서 계산하므로 너는 expression, eyeContact, postureStability 중심으로 평가해라.

면접 모드:
${mode || "unknown"}

반드시 아래 JSON 형식으로만 응답해라.
설명 문장이나 마크다운 코드블록은 넣지 마라.

{
  "expression": 0부터 100 사이의 숫자,
  "eyeContact": 0부터 100 사이의 숫자,
  "postureStability": 0부터 100 사이의 숫자,
  "summary": "카메라 분석 요약",
  "feedback": "카메라 분석 상세 피드백"
}
`;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            ...safeImages.map((imageUrl) => ({
              type: "input_image",
              image_url: imageUrl,
            })),
          ],
        },
      ],
    });

    const text = response.output_text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(text);

    return {
      expression: clampScore(parsed.expression ?? 70),
      eyeContact: clampScore(parsed.eyeContact ?? 70),
      postureStability: clampScore(parsed.postureStability ?? 70),
      speakingSpeed,
      intonation,
      summary:
        parsed.summary ||
        "화면상 관찰 기준으로 카메라 분석이 완료되었습니다.",
      feedback:
        parsed.feedback ||
        "면접 연습 참고용 카메라 분석 결과입니다.",
    };
  } catch (error) {
    console.error("카메라 AI 분석 실패:", error.message);

    return getCameraFallbackAnalysis({
      transcript,
      durationSeconds,
      volumeSamples,
      reason: error.message,
    });
  }
}

function getCameraEvalFallback({ questionText, answerText, cameraAnalysis, reason }) {
  const len = (answerText || "").trim().length;
  const base = len < 20 ? 48 : len < 80 ? 62 : 72;
  const cam = cameraAnalysis || {};
  const scores = {
    content: clampScore(base),
    voice: clampScore(cam.intonation ?? base - 2),
    eyeContact: clampScore(cam.eyeContact ?? base - 4),
    posture: clampScore(cam.postureStability ?? base - 3),
    confidence: clampScore(cam.expression ?? base - 1),
  };
  return {
    scores,
    feedback: {
      content: "답변의 핵심 경험과 본인 기여를 조금 더 구체적으로 말하면 좋습니다.",
      voice: "목소리 크기와 속도를 일정하게 유지해 보세요.",
      eyeContact: "카메라 렌즈를 보며 답변하면 신뢰감이 높아집니다.",
      posture: "어깨를 펴고 상체를 안정적으로 유지해 보세요.",
      confidence: "결론을 분명히 말하고 마지막 문장을 또렷하게 마무리해 보세요.",
      overall:
        reason ||
        "AI 평가 호출에 실패하여 참고용 피드백이 제공되었습니다. 답변은 저장되었습니다.",
      improvements: [
        "상황·행동·결과 구조로 답변하기",
        "본인 역할과 성과를 숫자나 사례로 설명하기",
      ],
    },
    summary: "면접 답변을 저장했으며, 참고용 피드백이 제공되었습니다.",
    overallScore: clampScore(
      (scores.content +
        scores.voice +
        scores.eyeContact +
        scores.posture +
        scores.confidence) /
        5
    ),
  };
}

/**
 * 카메라 면접 종합 평가 — 5개 항목 점수 + 항목별 피드백
 */
export async function generateCameraInterviewEvaluation({
  mode,
  questionText,
  answerText,
  cameraAnalysis,
  speakingSpeed,
  intonation,
}) {
  const cam = cameraAnalysis || {};
  const speedScore =
    speakingSpeed != null ? clampScore(speakingSpeed) : clampScore(cam.speakingSpeed ?? 70);
  const voiceScore =
    intonation != null ? clampScore(intonation) : clampScore(cam.intonation ?? 70);

  if (!client) {
    const fb = getCameraEvalFallback({
      questionText,
      answerText,
      cameraAnalysis: {
        ...cam,
        speakingSpeed: speedScore,
        intonation: voiceScore,
      },
      reason: "OPENAI_API_KEY가 없습니다.",
    });
    return mapCameraEvalToMetrics(fb, cam, speedScore, voiceScore);
  }

  const visualHint = cam.expression
    ? `표정(화면 관찰): ${cam.expression}, 시선: ${cam.eyeContact}, 자세: ${cam.postureStability}`
    : "카메라 시각 분석 없음";

  const input = `
${systemPrompt}

너는 AI 면접 연습 서비스의 평가자다. 아래 면접 답변과 카메라·음성 참고 정보를 바탕으로 평가해라.

면접 모드: ${mode || "basic"}
질문:
${questionText || "질문 없음"}

지원자 답변:
${answerText}

참고(카메라·음성, 0~100):
- ${visualHint}
- 말하기 속도 점수(서버 계산): ${speedScore}
- 음성 전달력/억양 점수(서버 계산): ${voiceScore}

반드시 아래 JSON만 응답해라. 각 점수는 서로 다르게 평가해라(모두 같은 숫자 금지).

{
  "scores": {
    "content": 0-100,
    "voice": 0-100,
    "eyeContact": 0-100,
    "posture": 0-100,
    "confidence": 0-100
  },
  "feedback": {
    "content": "답변 내용 평가 2~4문장",
    "voice": "음성 전달력 평가 2~3문장",
    "eyeContact": "시선 처리 평가 2~3문장",
    "posture": "자세·표정 평가 2~3문장",
    "confidence": "자신감 평가 2~3문장",
    "overall": "종합 피드백 2~4문장",
    "improvements": ["개선점1", "개선점2"]
  },
  "summary": "한 줄 요약",
  "overallScore": 0-100
}
`;

  try {
    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input,
    });
    const text = extractJsonText(response.output_text || "");
    const parsed = JSON.parse(text);
    const scores = {
      content: clampScore(parsed.scores?.content ?? 70),
      voice: clampScore(parsed.scores?.voice ?? voiceScore),
      eyeContact: clampScore(parsed.scores?.eyeContact ?? cam.eyeContact ?? 70),
      posture: clampScore(parsed.scores?.posture ?? cam.postureStability ?? 70),
      confidence: clampScore(parsed.scores?.confidence ?? cam.expression ?? 70),
    };
    const evalResult = {
      scores,
      feedback: {
        content: parsed.feedback?.content || "",
        voice: parsed.feedback?.voice || "",
        eyeContact: parsed.feedback?.eyeContact || "",
        posture: parsed.feedback?.posture || "",
        confidence: parsed.feedback?.confidence || "",
        overall: parsed.feedback?.overall || "",
        improvements: Array.isArray(parsed.feedback?.improvements)
          ? parsed.feedback.improvements
          : [],
      },
      summary: parsed.summary || "면접 평가가 완료되었습니다.",
      overallScore: clampScore(
        parsed.overallScore ??
          (scores.content +
            scores.voice +
            scores.eyeContact +
            scores.posture +
            scores.confidence) /
            5
      ),
    };
    return mapCameraEvalToMetrics(evalResult, cam, speedScore, voiceScore);
  } catch (error) {
    console.error("카메라 면접 종합 평가 실패:", error.message);
    const fb = getCameraEvalFallback({
      questionText,
      answerText,
      cameraAnalysis: cam,
      reason: error.message,
    });
    return mapCameraEvalToMetrics(fb, cam, speedScore, voiceScore);
  }
}

function mapCameraEvalToMetrics(evalResult, cameraAnalysis, speakingSpeed, intonation) {
  const s = evalResult.scores;
  const logicOffset = (s.content % 11) - 5;
  const logic = clampScore(Math.max(0, Math.min(100, s.content + logicOffset)));
  return {
    ...evalResult,
    deliveryMetrics: {
      expression: clampScore(cameraAnalysis?.expression ?? s.confidence),
      intonation: clampScore(intonation),
      postureStability: clampScore(s.posture),
      speakingSpeed: clampScore(speakingSpeed),
      eyeContact: clampScore(s.eyeContact),
    },
    contentMetrics: {
      communication: clampScore(s.content),
      logic,
    },
    competencyMetrics: {
      communication: clampScore(s.content),
      logic,
      problem_solving: clampScore(Math.round((s.content + s.confidence) / 2)),
      confidence: clampScore(s.confidence),
      job_fit: clampScore(Math.round((s.content + s.voice) / 2)),
    },
  };
}
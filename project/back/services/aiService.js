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
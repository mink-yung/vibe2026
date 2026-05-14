import dotenv from "dotenv";
import OpenAI from "openai";
import { personaPrompts } from "../data/personaPrompts.js";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateInterviewFeedback({
  persona,
  questionText,
  answerText,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 .env에 없습니다.");
  }

  const personaPrompt = personaPrompts[persona];

  if (!personaPrompt) {
    throw new Error("존재하지 않는 페르소나입니다.");
  }

  const input = `
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

  const response = await client.responses.create({
    model: process.env.AI_MODEL || "gpt-4o-mini",
    input,
  });

  const text = response.output_text;

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("AI 응답 JSON 파싱 실패:", text);

    return {
      feedback: text,
      nextQuestion: "답변을 조금 더 구체적으로 설명해주시겠어요?",
      summary: "AI 응답을 JSON으로 파싱하지 못해 전체 응답을 피드백으로 저장했습니다.",
      overallScore: 70,
    };
  }
}
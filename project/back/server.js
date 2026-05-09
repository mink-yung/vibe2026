import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const personaPrompts = {
  friendly: `
너는 친절하고 따뜻한 면접관이다.
지원자가 긴장하지 않고 편하게 답변할 수 있도록 부드럽고 정중한 말투를 사용한다.
답변이 부족하더라도 비난하지 않고, 먼저 긍정적인 부분을 짚은 뒤 개선 방향을 알려준다.
출력 형식은 [좋았던 점], [보완하면 좋은 점], [다음 질문], [응원 메시지]를 따른다.
`,

  pressure: `
너는 매우 냉정하고 압박감 있는 면접관이다.
지원자의 답변에서 논리 부족, 근거 부족, 추상적인 표현을 날카롭게 지적한다.
다만 조롱, 욕설, 인신공격, 차별, 외모 비하는 하지 않는다.
출력 형식은 [냉정한 평가], [압박 질문], [보완 요구]를 따른다.
`,

  sharp: `
너는 까칠하고 날카로운 면접관이다.
지원자의 답변에서 애매한 표현, 근거 부족, 논리의 빈틈을 찾아낸다.
말투는 정중하지만 차갑고 직설적이다.
출력 형식은 [짧은 평가], [꼬리 질문], [개선 방향]을 따른다.
`
};

app.get("/", (req, res) => {
  res.send("AI 면접 백엔드 서버 실행 중");
});

app.post("/api/interview/feedback", (req, res) => {
  const { persona, userAnswer } = req.body;

  if (!persona || !userAnswer) {
    return res.status(400).json({
      success: false,
      message: "persona와 userAnswer가 필요합니다."
    });
  }

  const selectedPrompt = personaPrompts[persona];

  if (!selectedPrompt) {
    return res.status(400).json({
      success: false,
      message: "존재하지 않는 면접관 타입입니다."
    });
  }

  // 지금은 AI API 연결 전이라 가짜 응답
  const mockFeedback = {
    friendly: {
      feedback: "[좋았던 점]\n답변에서 프로젝트에 참여한 경험이 드러났어요.\n\n[보완하면 좋은 점]\n다만 본인이 맡은 역할과 결과가 조금 더 구체적으로 들어가면 좋아요.\n\n[다음 질문]\n그 프로젝트에서 본인이 직접 해결한 문제는 무엇이었나요?\n\n[응원 메시지]\n좋아요. 경험을 조금씩 구체화하면 훨씬 좋은 답변이 될 수 있어요."
    },
    pressure: {
      feedback: "[냉정한 평가]\n답변이 아직 추상적입니다. 실제로 무엇을 했는지 판단하기 어렵습니다.\n\n[압박 질문]\n본인이 그 프로젝트에서 빠졌다면 결과가 달라졌을 만큼의 기여가 있었습니까?\n\n[보완 요구]\n역할, 행동, 결과를 구체적으로 말하세요."
    },
    sharp: {
      feedback: "[짧은 평가]\n답변이 평범합니다. 구체적인 근거가 부족합니다.\n\n[꼬리 질문]\n본인이 맡은 역할을 한 문장으로 명확히 설명해보세요.\n\n[개선 방향]\n막연한 표현보다 실제 행동과 결과를 중심으로 답변하세요."
    }
  };

  res.json({
    success: true,
    persona,
    userAnswer,
    promptPreview: selectedPrompt.trim(),
    result: mockFeedback[persona]
  });
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
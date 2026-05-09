const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { height, weight, faceShape } = body;

    if (!height || !weight || !faceShape) {
      return json({ error: "키, 몸무게, 얼굴형을 모두 입력해주세요." }, 400);
    }

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    try {
      const response = await client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: `너는 최고의 퍼스널 스타일리스트야. 키, 몸무게, 얼굴형 입력을 받으면 그걸 기반으로 아래 형식으로 답변해줘.

[퍼스널 컬러]
어울리는 컬러 톤과 대표 색상 3~5가지

[추천 스타일]
체형과 얼굴형에 맞는 전체적인 스타일 방향

[추천 아이템]
구체적인 의류/액세서리 아이템 5가지

[피해야 할 스타일]
체형과 얼굴형에 맞지 않는 스타일 3가지`,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `키: ${height}cm, 몸무게: ${weight}kg, 얼굴형: ${faceShape}`,
              },
            ],
          },
        ],
      });

      return json({ result: response.output_text });
    } catch (err) {
      console.error(err);
      return json({ error: "AI 추천 생성 중 오류가 발생했습니다." }, 500);
    }
  },
};

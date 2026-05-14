import express from "express";

const router = express.Router();

// 페르소나 목록 조회
// GET /api/personas
router.get("/", (req, res) => {
  return res.json({
    success: true,
    personas: [
      {
        id: "friendly",
        name: "친절한 면접관",
        description: "부드럽고 따뜻하게 피드백하는 면접관"
      },
      {
        id: "sharp",
        name: "까칠한 면접관",
        description: "날카롭게 부족한 점을 지적하는 면접관"
      },
      {
        id: "pressure",
        name: "압박 면접관",
        description: "실제 압박면접처럼 꼬리질문을 하는 면접관"
      }
    ]
  });
});

export default router;
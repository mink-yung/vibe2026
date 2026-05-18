/** 면접 평가 점수·멘트·색상 (프론트 mock — 추후 카메라 AI 분석 API로 대체 예정) */

const SCORE_MOCK_NOTE = '추후 카메라 AI 분석 API로 대체 예정';

const QUICK_METRIC_DEFS = [
  { key: 'speaking_speed', name: '말하기속도', icon: '⏱' },
  { key: 'intonation', name: '억양', icon: '🎵' },
  { key: 'confidence', name: '자신감', icon: '💪' },
  { key: 'communication', name: '의사소통', icon: '💬' },
];

const BASIC_DELIVERY_DEFS = [
  { key: 'expression', name: '표정', icon: '😊', cameraMock: true },
  { key: 'intonation', name: '억양', icon: '🎵', cameraMock: false },
  { key: 'posture', name: '자세안정성', icon: '🧍', cameraMock: true },
  { key: 'speaking_speed', name: '말하기속도', icon: '⏱', cameraMock: false },
  { key: 'gaze', name: '시선', icon: '👁', cameraMock: true },
];

const BASIC_CONTENT_DEFS = [
  { key: 'communication', name: '의사소통', icon: '💬', cameraMock: false },
  { key: 'logic', name: '논리적사고', icon: '🧠', cameraMock: false },
];

const REAL_ATTITUDE_DEFS = [
  { key: 'expression', name: '표정', icon: '😊', cameraMock: true },
  { key: 'intonation', name: '억양', icon: '🎵', cameraMock: false },
  { key: 'posture', name: '자세안정성', icon: '🧍', cameraMock: true },
  { key: 'speaking_speed', name: '말하기속도', icon: '⏱', cameraMock: false },
  { key: 'gaze', name: '시선', icon: '👁', cameraMock: true },
];

const REAL_COMPETENCY_DEFS = [
  { key: 'communication', name: '의사소통', icon: '💬', cameraMock: false },
  { key: 'logic', name: '논리적사고', icon: '🧠', cameraMock: false },
  { key: 'problem_solving', name: '문제해결력', icon: '🧩', cameraMock: false },
  { key: 'confidence', name: '자신감', icon: '💪', cameraMock: false },
  { key: 'job_fit', name: '직무역량', icon: '💼', cameraMock: false },
];

const BASIC_INTERVIEW_QUESTIONS = [
  '자기소개를 해주세요.',
  '지원 동기를 말해주세요.',
  '팀 프로젝트에서 본인이 맡은 역할은 무엇인가요?',
  '갈등 상황을 해결했던 경험을 말해주세요.',
  '본인의 강점과 보완할 점을 말해주세요.',
];

/** 실전 면접 12문항 — interviewer 1|2|3, 1→2→3 반복 */
const REAL_INTERVIEW_QUESTIONS = [
  { interviewer: 1, question: '자기소개를 해주세요.' },
  { interviewer: 2, question: '지원 동기를 구체적으로 말해주세요.' },
  { interviewer: 3, question: '본인의 답변이 너무 평범한데, 차별점이 무엇인가요?' },
  { interviewer: 1, question: '팀 프로젝트에서 본인이 맡은 역할은 무엇인가요?' },
  { interviewer: 2, question: '그 역할에서 가장 어려웠던 점은 무엇인가요?' },
  { interviewer: 3, question: '본인이 빠졌다면 프로젝트 결과가 달라졌을까요?' },
  { interviewer: 1, question: '갈등 상황을 해결했던 경험을 말해주세요.' },
  { interviewer: 2, question: '그 상황에서 본인의 판단이 옳았다고 생각하는 이유는 무엇인가요?' },
  { interviewer: 3, question: '다시 같은 상황이 온다면 다르게 행동할 점이 있나요?' },
  { interviewer: 1, question: '본인의 강점과 약점을 말해주세요.' },
  { interviewer: 2, question: '입사 후 어떤 방식으로 성장하고 싶나요?' },
  { interviewer: 3, question: '마지막으로 본인을 꼭 뽑아야 하는 이유를 말해주세요.' },
];

function clampScore100(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function hashSeed(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getScoreMent(score) {
  const s = clampScore100(score);
  if (s >= 90) return '최고예요!';
  if (s >= 80) return '잘했어요!';
  if (s >= 70) return '가능성이 보여요!';
  if (s >= 50) return '연습이 필요해요!';
  return '';
}

function getScoreColorClass(score) {
  const s = clampScore100(score);
  if (s >= 80) return 'green';
  if (s >= 70) return 'orange';
  if (s >= 50) return 'yellow';
  return 'red';
}

function getScoreStrokeColor(score) {
  const s = clampScore100(score);
  if (s >= 80) return '#2f9e44';
  if (s >= 70) return '#f76707';
  if (s >= 50) return '#f59f00';
  return '#e03131';
}

function getTagClass(score) {
  const s = clampScore100(score);
  if (s < 50) return 'warning';
  if (s >= 80) return 'good';
  if (s >= 70) return 'mid';
  return 'low';
}

/**
 * 추후 카메라 AI 분석 API로 대체 예정 — overall·답변 길이·항목별 시드로 임시 점수 생성
 */
function mockMetricScore(overallScore, metricKey, options) {
  const opts = options || {};
  const base = clampScore100(overallScore != null ? overallScore : 72);
  const len = (opts.answerText && String(opts.answerText).length) || 0;
  const lenBonus = Math.min(8, Math.floor(len / 40));
  const seed = hashSeed(`${metricKey}:${opts.seed || ''}:${opts.questionIndex ?? ''}`);
  const variance = (seed % 17) - 8;
  let score = base + variance + lenBonus;
  if (opts.cameraMock) {
    score = base + ((seed % 13) - 6);
  }
  return clampScore100(score);
}

function averageScores(scores) {
  const arr = scores.filter(s => s != null && !Number.isNaN(Number(s))).map(Number);
  if (!arr.length) return null;
  return clampScore100(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function buildMetricDisplayList(defs, overallScore, options) {
  const opts = options || {};
  const items = defs.map((def, i) => {
    const score = mockMetricScore(overallScore, def.key, {
      answerText: opts.answerText,
      seed: opts.seed,
      questionIndex: i,
      cameraMock: !!def.cameraMock,
    });
    const ment = getScoreMent(score);
    const color = getScoreColorClass(score);
    const descParts = [];
    if (ment) descParts.push(ment);
    if (def.cameraMock) descParts.push(SCORE_MOCK_NOTE);
    else if (opts.includeMockNote) descParts.push('텍스트 기반 추정 점수');
    return {
      key: def.key,
      name: def.name,
      icon: def.icon,
      score,
      color,
      ment,
      desc: descParts.join(' · ') || (score < 50 ? '더 연습이 필요합니다.' : ''),
      scoreClass: score < 50 ? 'score-warn' : '',
    };
  });
  const avg = averageScores(items.map(m => m.score));
  return { items, average: avg };
}

function scoresToRadar10(metricItems) {
  const labels = metricItems.map(m => m.name);
  const values = metricItems.map(m => Math.max(0, Math.min(10, Math.round(m.score / 10))));
  const scores = values.map(v => `${v}/10`);
  return { labels, values, scores };
}

/** API metrics.delivery → 화면용 metric item 배열 */
function metricItemsFromDeliveryApi(delivery, defs) {
  if (!delivery || !defs) return null;
  const keyMap = {
    expression: 'expression',
    intonation: 'intonation',
    posture: 'postureStability',
    speaking_speed: 'speakingSpeed',
    gaze: 'eyeContact',
  };
  const items = defs.map(function (def) {
    const apiKey = keyMap[def.key] || def.key;
    const score = clampScore100(delivery[apiKey] ?? delivery[def.key]);
    const ment = getScoreMent(score);
    return {
      key: def.key,
      name: def.name,
      icon: def.icon,
      score: score,
      color: getScoreColorClass(score),
      ment: ment,
      desc: ment || '',
      scoreClass: score < 50 ? 'score-warn' : '',
    };
  });
  return { items: items, average: averageScores(items.map(function (m) { return m.score; })) };
}

function metricItemsFromCompetencyApi(competency, defs) {
  if (!competency || !defs) return null;
  const items = defs.map(function (def) {
    const score = clampScore100(competency[def.key] ?? competency.communication);
    const ment = getScoreMent(score);
    return {
      key: def.key,
      name: def.name,
      icon: def.icon,
      score: score,
      color: getScoreColorClass(score),
      ment: ment,
      desc: ment || '',
      scoreClass: score < 50 ? 'score-warn' : '',
    };
  });
  return { items: items, average: averageScores(items.map(function (m) { return m.score; })) };
}

function metricItemsFromContentApi(content, defs) {
  if (!content || !defs) return null;
  const items = defs.map(function (def) {
    const score = clampScore100(content[def.key] ?? content.communication);
    const ment = getScoreMent(score);
    return {
      key: def.key,
      name: def.name,
      icon: def.icon,
      score: score,
      color: getScoreColorClass(score),
      ment: ment,
      desc: ment || '',
      scoreClass: score < 50 ? 'score-warn' : '',
    };
  });
  return { items: items, average: averageScores(items.map(function (m) { return m.score; })) };
}

function metricItemsFromScoresApi(scores) {
  if (!scores) return null;
  const defs = [
    { key: 'content', name: '답변내용', icon: '💬' },
    { key: 'voice', name: '음성전달', icon: '🎵' },
    { key: 'eyeContact', name: '시선', icon: '👁' },
    { key: 'posture', name: '자세·표정', icon: '🧍' },
    { key: 'confidence', name: '자신감', icon: '💪' },
  ];
  const items = defs.map(function (def) {
    const score = clampScore100(scores[def.key]);
    const ment = getScoreMent(score);
    return {
      key: def.key,
      name: def.name,
      icon: def.icon,
      score: score,
      color: getScoreColorClass(score),
      ment: ment,
      desc: ment || '',
      scoreClass: score < 50 ? 'score-warn' : '',
    };
  });
  return { items: items, average: averageScores(items.map(function (m) { return m.score; })) };
}

function formatDurationMs(ms) {
  if (ms == null || ms <= 0) return '-';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSummaryFromSession(p) {
  const elapsed = p.elapsedMs != null ? formatDurationMs(p.elapsedMs) : '-';
  const count = p.questionCount != null ? `${p.questionCount}개` : p.questions?.length ? `${p.questions.length}개` : '-';
  let avg = '-';
  if (p.elapsedMs && p.questions?.length) {
    avg = formatDurationMs(Math.floor(p.elapsedMs / p.questions.length));
  }
  return { time: elapsed, count, avg };
}

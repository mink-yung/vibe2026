var replayIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

const basicResultData = {
  subtitle: null,
  radar1: { labels: null, values: null, scores: null },
  radar2: { labels: null, values: null, scores: null },
  feedback: { summary: null, strengths: null, weaknesses: null, recommends: null },
  personas: null,
  questions: null,
  summary: { time: null, count: null, avg: null },
};

function drawRadarChart(svgId, cx, cy, maxR, labels, values, scores, maxVal) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';
  const n = labels.length;
  const levels = 5;
  const ns = 'http://www.w3.org/2000/svg';

  function angle(i) {
    return (Math.PI * 2 * i) / n - Math.PI / 2;
  }
  function point(r, i) {
    return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) };
  }
  function toPoints(pts) {
    return pts.map(function (p) {
      return p.x + ',' + p.y;
    }).join(' ');
  }

  for (let lv = 1; lv <= levels; lv++) {
    const pts = Array.from({ length: n }, function (_, i) {
      return point((maxR * lv) / levels, i);
    });
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', toPoints(pts));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#e9ecef');
    poly.setAttribute('stroke-width', '1');
    svg.appendChild(poly);
  }

  for (let i = 0; i < n; i++) {
    const p = point(maxR, i);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', cx);
    line.setAttribute('y1', cy);
    line.setAttribute('x2', p.x);
    line.setAttribute('y2', p.y);
    line.setAttribute('stroke', '#e9ecef');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  }

  const dataPts = values.map(function (v, i) {
    return point((maxR * v) / maxVal, i);
  });
  const dataPoly = document.createElementNS(ns, 'polygon');
  dataPoly.setAttribute('points', toPoints(dataPts));
  dataPoly.setAttribute('fill', 'rgba(116,192,252,0.25)');
  dataPoly.setAttribute('stroke', '#74c0fc');
  dataPoly.setAttribute('stroke-width', '2');
  svg.appendChild(dataPoly);

  dataPts.forEach(function (p) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', '#74c0fc');
    svg.appendChild(circle);
  });

  labels.forEach(function (label, i) {
    const labelR = svgId === 'radarChart' ? maxR + 18 : maxR + 22;
    const p = point(labelR, i);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', p.x);
    text.setAttribute('y', p.y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '11');
    text.setAttribute('fill', '#495057');
    text.setAttribute('font-weight', '600');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    text.textContent = label;
    svg.appendChild(text);
    if (scores) {
      const scoreEl = document.createElementNS(ns, 'text');
      scoreEl.setAttribute('x', p.x);
      scoreEl.setAttribute('y', p.y + 13);
      scoreEl.setAttribute('text-anchor', 'middle');
      scoreEl.setAttribute('font-size', '10');
      scoreEl.setAttribute('fill', '#868e96');
      scoreEl.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
      scoreEl.textContent = scores[i];
      svg.appendChild(scoreEl);
    }
  });
}

function truncateText(s, max) {
  const t = String(s || '');
  return t.length > max ? t.slice(0, max) + '\u2026' : t;
}

function renderBasicResult(data) {
  const { subtitle, radar1, radar2, feedback, personas, questions, summary } = data;

  if (subtitle) document.getElementById('bs-subtitle').textContent = subtitle;
  if (summary?.time) document.getElementById('bs-time').textContent = summary.time;
  if (summary?.count) document.getElementById('bs-count').textContent = summary.count;
  if (summary?.avg) document.getElementById('bs-avg').textContent = summary.avg;

  if (radar1?.labels && radar1?.values) {
    drawRadarChart('radarChart', 130, 130, 80, radar1.labels, radar1.values, radar1.scores, 10);
  }
  if (radar2?.labels && radar2?.values) {
    drawRadarChart('radarChart2', 140, 140, 80, radar2.labels, radar2.values, radar2.scores, 10);
  }

  if (feedback) {
    if (feedback.summary) document.getElementById('bs-fb-summary').textContent = feedback.summary;
    if (feedback.strengths) {
      document.getElementById('bs-fb-strengths').innerHTML = feedback.strengths
        .map(function (i) {
          return (
            '<div class="fb-item"><div class="fb-item-dot"></div><div><div class="fb-item-title">' +
            i.title +
            '</div><div class="fb-item-text">' +
            i.desc +
            '</div></div></div>'
          );
        })
        .join('');
    }
    if (feedback.weaknesses) {
      document.getElementById('bs-fb-weaknesses').innerHTML = feedback.weaknesses
        .map(function (i) {
          return (
            '<div class="fb-item"><div class="fb-item-dot"></div><div><div class="fb-item-title">' +
            i.title +
            '</div><div class="fb-item-text">' +
            i.desc +
            '</div></div></div>'
          );
        })
        .join('');
    }
    if (feedback.recommends) {
      document.getElementById('bs-fb-recommends').innerHTML = feedback.recommends
        .map(function (i) {
          return (
            '<div class="fb-item"><div class="fb-item-dot"></div><div class="fb-item-text">' +
            i.title +
            '</div></div>'
          );
        })
        .join('');
    }
  }

  const personaEl = document.getElementById('bs-persona-cards');
  if (personaEl && personas && personas.length) {
    personaEl.innerHTML = personas
      .map(function (p) {
        return (
          '<div class="bs-persona-card"><div class="bs-persona-name">' +
          p.name +
          '</div><p class="bs-persona-text">' +
          p.feedback +
          '</p></div>'
        );
      })
      .join('');
  }

  if (!questions) return;
  document.getElementById('bs-questions').innerHTML = questions
    .map(function (q, i) {
      return (
        '<div class="record-q-item"><div class="record-q-num">' +
        (i + 1) +
        '</div><div class="record-q-content"><div class="record-q-title">' +
        q.title +
        '</div><div class="record-q-feedback">' +
        q.feedback +
        '</div></div><button type="button" class="replay-btn">' +
        replayIcon +
        ' \ub2f5\ubcc0 \ub2e4\uc2dc \ub4e3\uae30</button></div>'
      );
    })
    .join('');
}

function buildBasicResultFromRealApi(d) {
  const apiOverall = d.overallScore != null ? Number(d.overallScore) : null;
  const answerText = d.answerText || '';
  const seed = String(d.interviewId || 'real');

  const attitudeBuilt =
    typeof buildMetricDisplayList === 'function'
      ? buildMetricDisplayList(REAL_ATTITUDE_DEFS, apiOverall ?? 72, {
          answerText: answerText,
          seed: seed + '-att',
        })
      : { items: [] };

  const competencyBuilt =
    typeof buildMetricDisplayList === 'function'
      ? buildMetricDisplayList(REAL_COMPETENCY_DEFS, apiOverall ?? 72, {
          answerText: answerText,
          seed: seed + '-comp',
          includeMockNote: true,
        })
      : { items: [] };

  const radar1 = typeof scoresToRadar10 === 'function' ? scoresToRadar10(competencyBuilt.items) : null;
  const radar2 = typeof scoresToRadar10 === 'function' ? scoresToRadar10(attitudeBuilt.items) : null;

  const personaMap = {
    friendly: '\uce5c\uc808\ud55c \uba74\uc811\uad00',
    sharp: '\ub839\ub9bd\ud55c \uba74\uc811\uad00',
    pressure: '\ubd80\ub2f4\uc744 \uc8fc\ub294 \uba74\uc811\uad00',
  };

  const personas = (d.feedbacks || []).map(function (f) {
    return {
      name: f.name || personaMap[f.persona] || f.persona,
      feedback: truncateText(f.feedback, 400),
    };
  });

  const strengths = personas.map(function (p) {
    return { title: p.name, desc: truncateText(p.feedback, 180) };
  });

  let subtitle = '\uc2e4\uc804 \uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  if (d.elapsedMs && typeof formatDurationMs === 'function') {
    subtitle =
      '\ucd1d ' + formatDurationMs(d.elapsedMs) + '\uc5d0 \uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  }

  return {
    subtitle: subtitle,
    radar1: radar1,
    radar2: radar2,
    feedback: {
      summary: d.summary || '',
      strengths: strengths.length ? strengths : null,
      weaknesses: null,
      recommends: d.summary
        ? [{ title: truncateText(d.summary, 120) }]
        : null,
    },
    personas: personas,
    questions: [{ title: d.questionText || '\uc9c8\ubb38', feedback: truncateText(d.summary, 500) }],
    summary: formatSummaryFromSession({ elapsedMs: d.elapsedMs, questionCount: 1 }),
  };
}

(function initBasicResultFromSession() {
  const raw = sessionStorage.getItem('basicInterviewLastResult');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      sessionStorage.removeItem('basicInterviewLastResult');
      renderBasicResult(buildBasicResultFromRealApi(parsed));
      return;
    } catch (_) {
      sessionStorage.removeItem('basicInterviewLastResult');
    }
  }
  renderBasicResult(basicResultData);
})();

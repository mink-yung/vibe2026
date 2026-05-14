function setActive(el) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// 파형 생성
const heights = [8,14,22,30,18,26,34,20,28,12,32,24,10,30,22,34,16,26,12,30,20,24,32,14,28,22,18,26,10,30,24,20];
const wf = document.getElementById('waveform');
if (wf) {
  heights.forEach(h => {
    const span = document.createElement('span');
    span.style.height = h + 'px';
    wf.appendChild(span);
  });
}

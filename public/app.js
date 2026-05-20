const searchForm = document.querySelector('#search-form');
const queryInput = document.querySelector('#search-query');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const editorSection = document.querySelector('#editor-section');
const previewAudio = document.querySelector('#preview-audio');
const startRange = document.querySelector('#clip-start-range');
const startInput = document.querySelector('#clip-start-input');
const clipForm = document.querySelector('#clip-form');
const clipButton = document.querySelector('#clip-button');
const downloadLink = document.querySelector('#download-link');
const editorTitle = document.querySelector('#editor-title');

let selectedTrackId = null;
let selectedTitle = '';
let statusTimer = null;

setStatus('검색어 또는 YouTube URL을 입력하세요.');

searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  const input = queryInput.value.trim();
  if (!input) {
    setStatus('검색어 또는 YouTube URL을 입력하세요.', true);
    return;
  }

  clearEditor();
  clearResults();

  try {
    setBusy(searchForm, true);
    if (isProbablyYouTubeUrl(input)) {
      await prepareTrack(input, 'YouTube audio');
      return;
    }

    setStatus('검색 중입니다.');
    const payload = await postJson('/api/search', { query: input });
    renderResults(payload.results || []);
    setStatus(payload.results?.length ? '결과를 선택하세요.' : '검색 결과가 없습니다.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(searchForm, false);
  }
});

clipForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedTrackId) {
    setStatus('먼저 오디오를 준비하세요.', true);
    return;
  }

  try {
    clipButton.disabled = true;
    downloadLink.hidden = true;
    setStatus('30초 MP3를 만드는 중입니다.');
    const clip = await postJson('/api/clip', {
      id: selectedTrackId,
      startSeconds: Number(startInput.value),
    });

    downloadLink.href = clip.downloadUrl;
    downloadLink.download = `${selectedTitle || 'ringtone'}-ringtone.mp3`;
    downloadLink.textContent = 'MP3 다운로드';
    downloadLink.hidden = false;
    setStatus('완성되었습니다. 다운로드 버튼을 누르세요.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    clipButton.disabled = false;
  }
});

startRange.addEventListener('input', () => {
  startInput.value = startRange.value;
  previewAudio.currentTime = Number(startRange.value);
});

startInput.addEventListener('input', () => {
  startRange.value = startInput.value;
});

function renderResults(items) {
  clearResults();

  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result';

    const title = document.createElement('span');
    title.className = 'result-title';
    title.textContent = item.title || '제목 없음';

    const meta = document.createElement('span');
    meta.className = 'result-meta';
    meta.textContent = [item.channel, formatDuration(item.duration)].filter(Boolean).join(' · ');

    button.append(title, meta);
    button.addEventListener('click', () => prepareTrack(item.url, item.title || 'YouTube audio'));
    results.append(button);
  }
}

async function prepareTrack(url, title) {
  clearEditor();
  startStatusTimer('오디오를 준비하는 중입니다');
  try {
    const track = await postJson('/api/prepare', { url, title });

    selectedTrackId = track.id;
    selectedTitle = track.title;
    editorTitle.textContent = track.title;
    previewAudio.src = track.audioUrl;

    const maxStart = Math.max(0, Math.floor(Number(track.durationSeconds || 0) - 30));
    startRange.max = String(maxStart);
    startInput.max = String(maxStart);
    startRange.value = '0';
    startInput.value = '0';

    editorSection.hidden = false;
    setStatus('미리듣기 후 시작 시간을 선택하세요.');
  } finally {
    stopStatusTimer();
  }
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || '요청에 실패했습니다.');
  }
  return payload;
}

function clearResults() {
  results.replaceChildren();
}

function clearEditor() {
  selectedTrackId = null;
  selectedTitle = '';
  stopPreviewAudio();
  editorSection.hidden = true;
  downloadLink.hidden = true;
}

function stopPreviewAudio() {
  previewAudio.pause();
  previewAudio.currentTime = 0;
  previewAudio.removeAttribute('src');
  previewAudio.load();
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'info';
}

function startStatusTimer(prefix) {
  stopStatusTimer();
  const startedAt = Date.now();
  const update = () => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    setStatus(`${prefix}. ${elapsed}초 경과. 긴 영상은 준비할 수 없습니다.`);
  };
  update();
  statusTimer = setInterval(update, 1000);
}

function stopStatusTimer() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
}

function setBusy(form, busy) {
  for (const element of form.querySelectorAll('button, input')) {
    element.disabled = busy;
  }
}

function formatDuration(duration) {
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function isProbablyYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

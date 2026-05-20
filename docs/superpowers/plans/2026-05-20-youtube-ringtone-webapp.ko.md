# 유튜브 벨소리 웹앱 구현 계획

> **에이전트 작업자용:** 이 계획을 실제 구현할 때는 `superpowers:subagent-driven-development` 권장, 또는 `superpowers:executing-plans`를 사용해 작업 단위별로 진행한다. 각 단계는 체크박스(`- [ ]`)로 추적한다.

**목표:** Windows PC에서 실행되는 개인용 웹앱을 만들어, 유튜브 검색어 또는 URL로 오디오를 준비하고 원하는 시작점부터 30초짜리 MP3를 잘라 PC나 휴대폰 브라우저에서 다운로드할 수 있게 한다.

**아키텍처:** Node.js + Express 서버가 정적 브라우저 UI를 제공하고 JSON, 오디오 스트리밍, 다운로드 엔드포인트를 제공한다. 백엔드는 모든 파일 경로를 직접 관리하고, 사용자 입력을 검증하며, 안전한 인자 배열로 조립한 고정 `yt-dlp`와 `ffmpeg` 명령만 실행한다.

**기술 스택:** Node.js 20 이상, Express, Node 기본 `node:test`, `yt-dlp`, `ffmpeg`, plain HTML/CSS/브라우저 JavaScript.

---

## 파일 구조

- `package.json`: npm 스크립트와 의존성.
- `.gitignore`: `node_modules/`, 실행 중 생기는 `data/`, 로그, 로컬 환경 파일 제외.
- `src/config.js`: 호스트, 포트, 데이터 폴더, 결과 제한, 명령어 이름.
- `src/errors.js`: 앱 전용 오류와 JSON 오류 응답.
- `src/validation.js`: URL, 검색어, 시간, id 검증과 파일명 정리.
- `src/jobs.js`: 준비된 트랙과 생성된 클립의 메모리 메타데이터.
- `src/processRunner.js`: 타임아웃과 구조화된 출력을 가진 안전한 자식 프로세스 실행 래퍼.
- `src/tools.js`: `yt-dlp`, `ffmpeg`, `ffprobe` 시작 시 확인.
- `src/youtube.js`: 유튜브 검색과 오디오 다운로드 함수.
- `src/audio.js`: MP3 미리듣기 변환, 길이 확인, 30초 자르기.
- `src/server.js`: Express 앱, 정적 UI, API 라우트, 스트리밍, 다운로드 응답.
- `public/index.html`: 모바일 친화적인 단일 페이지 UI.
- `public/styles.css`: 작고 반응형인 스타일.
- `public/app.js`: 브라우저 상호작용, API 호출, 오디오 미리듣기, 슬라이더, 다운로드 링크.
- `tests/validation.test.js`: 순수 검증 함수 단위 테스트.
- `tests/server.test.js`: 잘못된 입력과 JSON 오류 형태를 확인하는 라우트 테스트.

## 작업 1: 프로젝트 뼈대 만들기

**파일:**
- 생성: `package.json`
- 생성: `.gitignore`
- 생성: `src/config.js`
- 생성: `public/index.html`
- 생성: `public/styles.css`
- 생성: `public/app.js`

- [ ] **1단계: npm 패키지 메타데이터 생성**

`package.json`을 만든다.

```json
{
  "name": "yt-ringtone",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {}
}
```

- [ ] **2단계: 실행 산출물 제외 설정**

`.gitignore`를 만든다.

```gitignore
node_modules/
data/
.env
*.log
```

- [ ] **3단계: 앱 설정 파일 생성**

`src/config.js`를 만든다.

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  rootDir,
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  dataDir: path.join(rootDir, 'data'),
  maxSearchResults: 5,
  maxQueryLength: 120,
  clipDurationSeconds: 30,
  commandTimeoutMs: 120000,
  ytdlpCommand: process.env.YTDLP || 'yt-dlp',
  ffmpegCommand: process.env.FFMPEG || 'ffmpeg',
  ffprobeCommand: process.env.FFPROBE || 'ffprobe'
};
```

- [ ] **4단계: 최소 정적 UI 파일 생성**

`public/index.html`, `public/styles.css`, `public/app.js`를 만든다. 첫 화면은 검색 입력, 상태 메시지, 결과 영역, 편집 영역을 가진다. UI는 모바일에서 먼저 읽기 쉽게 만들고, API가 붙기 전에는 `검색어 또는 YouTube URL을 입력하세요.`라는 상태 문구를 보여준다.

- [ ] **5단계: 의존성 설치**

실행: `npm install`

예상 결과: `package-lock.json`이 생성되고 `express`가 설치된다.

- [ ] **6단계: 뼈대 커밋**

```bash
git add package.json package-lock.json .gitignore src/config.js public/index.html public/styles.css public/app.js
git commit -m "feat: scaffold ringtone webapp"
```

## 작업 2: 검증과 오류 처리 기반

**파일:**
- 생성: `src/errors.js`
- 생성: `src/validation.js`
- 생성: `tests/validation.test.js`

- [ ] **1단계: 검증 테스트 작성**

`tests/validation.test.js`에 다음을 검증하는 테스트를 작성한다.

- `youtube.com`, `youtu.be` URL은 허용한다.
- 다른 도메인의 URL은 유튜브 URL로 보지 않는다.
- 빈 검색어와 너무 긴 검색어는 거부한다.
- 시작 시간은 0 이상이어야 하고, 시작 시간 + 30초가 오디오 길이를 넘으면 거부한다.
- 파일명에 위험한 문자는 안전한 문자로 바꾼다.

- [ ] **2단계: 테스트 실패 확인**

실행: `npm test`

예상 결과: `src/validation.js`가 아직 없으므로 실패한다.

- [ ] **3단계: 앱 오류 타입 구현**

`src/errors.js`에 `AppError`와 `sendError(res, error)`를 구현한다. `AppError`는 `message`, `status`, `code`를 갖고, `sendError`는 `{ error: { code, message } }` 형태의 JSON을 반환한다.

- [ ] **4단계: 검증 함수 구현**

`src/validation.js`에 다음 함수를 구현한다.

- `isYouTubeUrl(value)`
- `validateSearchQuery(value, maxLength)`
- `validateStartSeconds(value, durationSeconds, clipDurationSeconds)`
- `sanitizeFilePart(value)`

각 함수는 잘못된 입력에서 `AppError`를 던지고, 파일명 정리 함수는 빈 결과일 때 `audio`를 반환한다.

- [ ] **5단계: 테스트 통과 확인**

실행: `npm test`

예상 결과: `tests/validation.test.js`가 통과한다.

- [ ] **6단계: 검증 기반 커밋**

```bash
git add src/errors.js src/validation.js tests/validation.test.js
git commit -m "feat: add validation foundation"
```

## 작업 3: 프로세스 실행기와 도구 확인

**파일:**
- 생성: `src/processRunner.js`
- 생성: `src/tools.js`

- [ ] **1단계: 안전한 프로세스 실행기 구현**

`src/processRunner.js`를 만든다. `spawn(command, args, { windowsHide: true })`로 실행하고, stdout/stderr를 모으며, 타임아웃 시 프로세스를 종료하고 `COMMAND_TIMEOUT` 오류를 반환한다. 실행 파일을 찾지 못하면 `COMMAND_NOT_FOUND`, 종료 코드가 0이 아니면 `COMMAND_FAILED`를 반환한다.

- [ ] **2단계: 시작 시 외부 도구 확인 구현**

`src/tools.js`를 만든다. 다음 명령이 10초 안에 실행되는지 확인한다.

```bash
yt-dlp --version
ffmpeg -version
ffprobe -version
```

명령 이름은 `src/config.js`의 `config.ytdlpCommand`, `config.ffmpegCommand`, `config.ffprobeCommand`를 사용한다.

- [ ] **3단계: 기존 테스트 확인**

실행: `npm test`

예상 결과: 기존 검증 테스트가 계속 통과한다.

- [ ] **4단계: 프로세스 유틸리티 커밋**

```bash
git add src/processRunner.js src/tools.js
git commit -m "feat: add media tool process runner"
```

## 작업 4: 작업 저장소와 오디오 처리

**파일:**
- 생성: `src/jobs.js`
- 생성: `src/audio.js`

- [ ] **1단계: 메모리 작업 저장소 구현**

`src/jobs.js`를 만든다. `crypto.randomUUID()`로 트랙과 클립 id를 만들고, `Map`에 저장한다.

필요한 함수:

- `createTrack(data)`
- `getTrack(id)`
- `createClip(data)`
- `getClip(id)`

없는 id를 요청하면 각각 `TRACK_NOT_FOUND`, `CLIP_NOT_FOUND` 오류를 던진다.

- [ ] **2단계: 오디오 헬퍼 구현**

`src/audio.js`를 만든다.

필요한 함수:

- `ensureDataDirs()`: `data/source`, `data/preview`, `data/clips` 폴더 생성.
- `probeDurationSeconds(filePath)`: `ffprobe`로 오디오 길이 확인.
- `convertPreviewMp3(sourcePath, outputPath)`: `ffmpeg`로 미리듣기 MP3 변환.
- `createThirtySecondClip(previewPath, outputPath, startSeconds)`: `ffmpeg -ss 시작 -t 30`으로 30초 MP3 생성.

- [ ] **3단계: 테스트 실행**

실행: `npm test`

예상 결과: 기존 테스트 통과.

- [ ] **4단계: 작업/오디오 헬퍼 커밋**

```bash
git add src/jobs.js src/audio.js
git commit -m "feat: add audio job helpers"
```

## 작업 5: 유튜브 검색과 다운로드

**파일:**
- 생성: `src/youtube.js`

- [ ] **1단계: 유튜브 래퍼 구현**

`src/youtube.js`를 만든다.

필요한 함수:

- `searchYouTube(query)`: `yt-dlp ytsearch5:<query> --dump-json --flat-playlist --no-warnings`를 실행하고, 제목, URL, 채널, 길이, 썸네일을 반환한다.
- `downloadAudio(url, title, id)`: `yt-dlp -f bestaudio/best --no-playlist --extract-audio --audio-format mp3 --audio-quality 0`로 오디오를 `data/source`에 MP3로 저장한다.

출력 파일명은 앱이 만든 id와 `sanitizeFilePart(title)`을 조합해 만든다.

- [ ] **2단계: 테스트 실행**

실행: `npm test`

예상 결과: 기존 테스트 통과.

- [ ] **3단계: 유튜브 래퍼 커밋**

```bash
git add src/youtube.js
git commit -m "feat: add youtube media wrapper"
```

## 작업 6: Express 서버와 API 라우트

**파일:**
- 생성: `src/server.js`
- 생성: `tests/server.test.js`

- [ ] **1단계: 잘못된 입력 라우트 테스트 작성**

`tests/server.test.js`를 만든다. Node 기본 `node:test`, `node:http`, `fetch`를 사용한다.

테스트할 내용:

- `POST /api/search`에 빈 검색어를 보내면 HTTP 400과 `EMPTY_QUERY`를 반환한다.
- `POST /api/clip`에 없는 트랙 id를 보내면 HTTP 404와 `TRACK_NOT_FOUND`를 반환한다.

- [ ] **2단계: 라우트 테스트 실패 확인**

실행: `npm test`

예상 결과: `src/server.js`가 아직 없거나 `createApp`을 export하지 않아 실패한다.

- [ ] **3단계: Express 서버 구현**

`src/server.js`를 만든다.

필요한 라우트:

- `GET /`: `public/` 정적 UI 제공.
- `POST /api/search`: 검색어 검증 후 `searchYouTube(query)` 호출.
- `POST /api/prepare`: URL과 제목을 받아 오디오 다운로드, 길이 확인, 트랙 메타데이터 반환.
- `GET /api/audio/:id`: 준비된 MP3 파일 스트리밍.
- `POST /api/clip`: 트랙 id와 시작 시간을 받아 30초 MP3 생성.
- `GET /api/download/:clipId`: 생성된 MP3 다운로드.

서버 시작 시에는 `ensureDataDirs()`와 `checkTools()`를 실행한다. `0.0.0.0`처럼 외부 접속 가능한 호스트에 바인딩하면 콘솔에 경고를 출력한다.

- [ ] **4단계: 테스트 통과 확인**

실행: `npm test`

예상 결과: 검증 테스트와 라우트 테스트가 모두 통과한다.

- [ ] **5단계: API 서버 커밋**

```bash
git add src/server.js tests/server.test.js
git commit -m "feat: add ringtone api server"
```

## 작업 7: 브라우저 UI 동작

**파일:**
- 수정: `public/app.js`

- [ ] **1단계: 전체 브라우저 동작 구현**

`public/app.js`를 검색/선택/미리듣기/자르기/다운로드 흐름으로 교체한다.

필요한 동작:

- 검색 폼 제출 시 `/api/search` 호출.
- 결과 목록 렌더링.
- 결과 클릭 시 `/api/prepare` 호출.
- 준비된 오디오를 `<audio>`에 연결.
- 시작 시간 슬라이더와 숫자 입력을 동기화.
- `30초 MP3 만들기` 클릭 시 `/api/clip` 호출.
- 성공 시 `/api/download/:clipId` 링크 표시.
- 실패 시 서버가 보낸 한국어 오류 메시지 표시.

- [ ] **2단계: 테스트 실행**

실행: `npm test`

예상 결과: 모든 테스트 통과.

- [ ] **3단계: 브라우저 워크플로 커밋**

```bash
git add public/app.js
git commit -m "feat: add ringtone browser workflow"
```

## 작업 8: 최종 로컬 검증

**파일:**
- 검증 중 명확한 결함이 발견될 때만 코드 수정.

- [ ] **1단계: 외부 도구 확인**

실행: `yt-dlp --version`

예상 결과: 버전 출력.

실행: `ffmpeg -version`

예상 결과: ffmpeg 버전 정보 출력.

- [ ] **2단계: 서버 시작**

실행: `npm start`

예상 결과: `YT Ringtone listening at http://0.0.0.0:3000` 로그 출력.

- [ ] **3단계: PC 브라우저 테스트**

열기: `http://127.0.0.1:3000`

예상 결과:

- 페이지가 열린다.
- 검색 입력창이 보인다.
- 검색어를 입력하면 최대 5개 결과가 나온다.
- 결과를 선택하면 재생 가능한 오디오가 준비된다.
- 시작 시간을 고르고 버튼을 누르면 다운로드 링크가 생긴다.
- 다운로드한 파일은 약 30초 길이의 MP3다.

- [ ] **4단계: 휴대폰 브라우저 테스트**

`ipconfig`로 PC IPv4 주소를 확인한 뒤, 휴대폰에서 `http://PC_IP:3000`을 연다.

예상 결과:

- 휴대폰에서 페이지가 열린다.
- 생성된 MP3가 휴대폰 브라우저로 다운로드된다.

- [ ] **5단계: 검증 중 수정이 있었을 때만 커밋**

검증 중 코드 수정이 필요했다면:

```bash
git status --short
git add public/app.js src/server.js src/audio.js src/youtube.js src/validation.js tests/server.test.js tests/validation.test.js
git commit -m "fix: stabilize ringtone workflow"
```

`git add` 명령에는 실제로 변경된 파일만 포함한다. 수정이 없었다면 커밋하지 않는다.

## 자체 검토 메모

- 설계 범위 반영: 검색, URL 준비, 미리듣기, 30초 자르기, 다운로드, Windows 로컬 호스팅, 로그인 없는 제약, 휴대폰 브라우저 접속이 모두 작업에 포함되어 있다.
- 의도적으로 제외한 범위: 파형 편집, 벨소리 자동 지정, 클라우드 호스팅, 계정, 일괄 변환은 구현 작업에 넣지 않았다.
- 이름과 타입 일관성: `validateSearchQuery`, `validateStartSeconds`, 작업 id, `track.id`, `clip.id`는 라우트와 UI 작업에서 사용되기 전에 먼저 정의된다.

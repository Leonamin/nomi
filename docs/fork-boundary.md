> **문서 이관 · 2026-10-16:** [현재 fork 경계 결정](../wiki/decisions/0001-web-first-fork.md)를 먼저 읽으세요. 아래 원문은 이관 전 기록으로 보존하며 현재 지식의 병행 갱신 대상으로 사용하지 않습니다. 코드·기계 계약과 최신 검증 근거는 위키에서 연결합니다.

# fork 소유 경로 경계 — web 우선

📎 2026-10-13 사용자 결정. 이 fork는 **개인용 Web 버전을 우선(fork-first / web-first)**한다. upstream(`aqm857886159/Nomi`, AGPL-3.0-only, 검증 기준 `66d6eafed07ad6239acd765dd05c9eb0870cf849` = v0.23.1)과의 공통 이력은 유지하되, 새 작업은 **포크 소유 경로**에 둔다.

## 포크 소유 경로 — 자유롭게 변경

upstream에 없고 이 fork가 소유한다. 여기서는 fork 가정을 마음껏 써도 된다.

| 경로 | 내용 |
| --- | --- |
| `web/` | 브라우저 호스트. Hono 서버·표면·RPC, 생성 작업, 외부 엔진 에이전트 lane과 MCP 브리지 |
| `scripts/web/` | 웹 배포·설치 스크립트 |
| `src/i18n/locales/ko/`, `electron/locales/` | 한국어 문구 (upstream은 zh-CN/en만) |
| `docs/fork-boundary.md`, `docs/personal-web.md`, `docs/user-guide.ko.md` | 이 fork의 운영·사용자 안내 |
| `docs/plan/2026-10-12-*.md`, `docs/qa/2026-10-12-*.md`, `docs/fixes/2026-10-12-web-*.root-cause.json` | 이 fork의 계획·검증·근본원인 기록 |
| `tests/ux/`의 fork 전용 walk | 웹 실사용 검증 |

## 공유 경로 — upstream과 공통, 최소·일반적으로만

`src/`·`electron/`의 기존 파일 대부분, `package.json`·`pnpm-lock.yaml`·빌드/CI 설정, `CLAUDE.md`/`AGENTS.md`.

## 규칙

1. **새 기능은 포크 소유 경로에 둔다.** 공유 파일에 fork 전용 분기를 넣지 않는다.
2. 공유 파일을 고칠 때 **"upstream도 원하는 변경인가"**를 먼저 묻는다. 그렇다면 fork 가정 없이 일반적으로 쓴다 — 업스트림 PR 여지와 값싼 병합을 둘 다 지킨다.
3. **`CLAUDE.md`/`AGENTS.md`를 web-first로 뒤집지 않는다.** 웹 우선의 정본은 이 문서다. 업스트림 discipline 파일은 중립으로 둔다.
4. upstream 동기화가 필요하면 remote를 다시 붙여 격차가 벌어지지 않게 관리한다.

   ```sh
   git remote add upstream https://github.com/aqm857886159/Nomi.git
   git fetch upstream && git merge upstream/main
   ```

## 알려진 상속 debt

`check:concept-owners`는 advisory로 실패한다 — fork의 web 근본원인 계약(`docs/fixes/2026-10-12-web-*.root-cause.json`)이 등록 개념의 write_api에 아직 안 묶여 있다. main의 `.github/workflows/docs-autosync.yml`이 자동 보충하므로 개별 PR에서 단독 commit으로 고치지 않는다.

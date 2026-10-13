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

## 병합 정책 (2026-10-13 사용자 결정)

- **CI를 기다리지 않는다.** 저장소 Actions를 **껐다** — PR에 체크가 뜨지 않고, 병합은 즉시 가능하다.
  ```sh
  gh api -X PUT repos/Leonamin/nomi/actions/permissions -F enabled=false   # 끄기
  gh api -X PUT repos/Leonamin/nomi/actions/permissions -F enabled=true    # 되돌리기
  ```
- **품질 검사는 로컬에서 한다**: `pnpm run gates`가 CI의 Contracts 잡과 **같은 스크립트**를 돌린다. 원격 사본이 사라져도 품질 자체는 유지된다. 병합 전 스캔은 `pnpm run merge:preflight <PR>`.
- **왜**: CI는 애초에 병합을 막은 적이 없다(main에 branch protection·ruleset 없음). 그런데 그 빨간 표시를 기다리느라 작업 흐름이 끊겼다 — 사용자 판단으로 **하루의 절반이 CI 대기로 사라졌다**. 그래서 표시 자체를 없앤다.
- **잃는 것 하나**: `docs-autosync`가 문서 인덱스/상태표 자동 PR을 더 이상 만들지 않는다 → `check:docs-index`·`check:doc-status`는 필요할 때 손으로 맞춘다. 데스크톱 릴리스 워크플로도 함께 멈추므로, 데스크톱 패키징이 필요해지면 Actions를 다시 켠다.
- (기록) 결정 전의 실례: #19를 검사 대기 중 병합 → main Quality Gate red → 그 red를 확인하느라 또 대기. 같은 고리를 끊기 위해 Actions를 껐다.

## 알려진 상속 debt

`check:concept-owners`는 advisory로 실패한다 — fork의 web 근본원인 계약(`docs/fixes/2026-10-12-web-*.root-cause.json`)이 등록 개념의 write_api에 아직 안 묶여 있다. main의 `.github/workflows/docs-autosync.yml`이 자동 보충하므로 개별 PR에서 단독 commit으로 고치지 않는다.

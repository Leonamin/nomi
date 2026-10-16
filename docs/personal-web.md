> **문서 이관 · 2026-10-16:** [현재 웹 실행·배포 안내](../wiki/guides/web-host-release.md)를 먼저 읽으세요. 아래 원문은 이관 전 기록으로 보존하며 현재 지식의 병행 갱신 대상으로 사용하지 않습니다. 코드·기계 계약과 최신 검증 근거는 위키에서 연결합니다.

# Nomi 개인용 웹 버전

이 fork는 실제 검증한 upstream v0.23.1 (`66d6eafed07ad6239acd765dd05c9eb0870cf849`)의 UI, 프로젝트 형식, 후보, 타임라인과 FFmpeg 내보내기를 사용한다. 브라우저는 기존 preload 계약을 HTTP로 호출하며 Electron/noVNC를 실행하지 않는다.

경계(포크 소유 경로와 web 우선)는 [fork 경계](fork-boundary.md)에 정리한다.

수동 ComfyUI 생성과 서버 MP4 내보내기는 브라우저 수명과 분리된다. 수락 전 intent와 수락한 prompt ID를 별도 작업 파일에 기록한다. 재접속 중에는 서버의 작업 상태를 조회한다. 서버가 재시작되면 수락한 생성은 같은 prompt ID를 다시 조회하며, 수락 여부가 불명확한 요청은 자동 재제출하지 않는다. 진행 중 export의 서비스 재시작은 기존 export manager가 중단 실패로 회수하고 사용자가 새 내보내기를 시작한다. 완료된 파일은 보존된다.

후보 선택은 노드의 현재 후보만 바꾼다. 이미 배치한 컷은 별도 **Replace shot / 替换镜头** 버튼으로 교체한다. 순서, 배치, source in-point, 보이는 길이, framing과 audio 설정을 유지한다. 새 소스가 이 구간보다 짧으면 전체 교체를 거절한다. 타임라인 교체는 undo할 수 있다.

TTS, 내장 AI 에이전트의 자동 제작·자동 검증·재생성, 결제, 다중 사용자 SaaS는 제공하지 않는다. 대신 운영자가 서버에 OpenCode 또는 Codex를 설치·설정하면 에이전트 패널에서 프로젝트와 모델을 읽고, 생성 카드를 만들고, 사용자 승인 뒤 생성을 제출할 수 있다. 외부 유료 API 키를 넣는 것으로 생성이 활성화되지는 않는다. 생성 RPC는 auth-none 로컬 ComfyUI와 지원된 이미지/영상 작업만 허용한다. 브라우저 녹화가 필요한 export backend는 서버에서 명확하게 거절한다. 타임라인의 일반 영상·이미지·오디오 FFmpeg 경로를 사용한다.

## 실행

Node 24와 저장소에 지정한 pnpm을 사용한다. 서버에도 전체 의존성을 설치한다. 웹의 Hono는 원래 Electron 설치 패키지에 추가되지 않도록 devDependencies에 둔다.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:web
NOMI_WEB_DATA_DIR=/absolute/dedicated/data NOMI_WEB_PORT=9031 corepack pnpm run start:web
```

`NOMI_WEB_DATA_DIR`는 기존 desktop 데이터와 분리된 실제 디렉터리여야 한다. symlink 데이터 루트/설정/프로젝트 루트를 거절한다. 프로젝트·assets·exports는 이 루트 아래에만 만들어진다. 정적 파일은 `dist/web/client`에 한정하고 미디어는 기존 owned-file/range 경계를 사용한다. 공개 소스 `/source`는 실행한 `NOMI_BUILD_SHA`를 가리키며 설정의 About에도 소스와 AGPL 링크가 있다.

## 웹 호스트 운영

`scripts/web/deploy-web-host.mjs`는 경로·포트·호스트를 전부 환경변수에서 읽는다. 기본값은 `$HOME` 기준이라 특정 장비에 묶이지 않는다.

| 환경변수 | 의미 | 기본값 |
| --- | --- | --- |
| `NOMI_WEB_RELEASE_DIR` | release/current 루트 | `$HOME/apps/nomi-web` |
| `NOMI_WEB_DATA_DIR` | 전용 웹 데이터 루트 | `$HOME/nomi-web-data` |
| `NOMI_WEB_LEGACY_DATA_DIR` | 분리해야 하는 기존 데이터 루트 | `$HOME/nomi-data` |
| `NOMI_WEB_ORIGIN` | 정확한 Host/Origin 경계 | `http://127.0.0.1:$NOMI_WEB_PORT` |
| `NOMI_WEB_PORT` | 로컬 웹 포트 | `9031` |
| `NOMI_WEB_COMFYUI_SSH` | GPU 터널 ssh 대상(`user@host`), 비우면 터널 unit을 만들지 않음 | (없음) |
| `NOMI_WEB_COMFYUI_PORT` | 로컬 터널 포트 | `19188` |
| `NOMI_WEB_COMFYUI_TARGET_PORT` | 원격 ComfyUI 포트 | `8188` |
| `NOMI_WEB_SOURCE_REPO` | `/source`가 가리킬 공개 소스 base | upstream `aqm857886159/Nomi` |
| `NOMI_WEB_NODE_BIN` | unit의 node 실행 파일 | 실행 중인 node |
| `NOMI_WEB_SSH_BIN` | unit의 ssh 실행 파일 | `/usr/bin/ssh` |
| `NOMI_WEB_SYSTEMD_USER_DIR` | user unit 디렉터리 | `$HOME/.config/systemd/user` |
| `NOMI_WEB_KEEP_RELEASES` | 활성화 후 남길 release 수(미지정 = 전부 보존) | (없음) |

`scripts/web/deploy.sh` 는 위 절차(호스트 저장소 fetch → 정확한 커밋 release worktree → 배포 스크립트 호출)를 한 줄로 묶는다. 호스트 설정 파일을 `--env` 로 넘기면 경로·포트·호스트를 그 파일에서 읽는다. **데이터 루트는 건드리지 않는다.**

```sh
scripts/web/deploy.sh --env /opt/nomi/deploy.env            # 호스트 저장소 origin/main 최신
scripts/web/deploy.sh --env /opt/nomi/deploy.env <40자리 commit>
```

`NOMI_WEB_KEEP_RELEASES=1` 로 배포하면 새 버전으로 재시작한 뒤 **이전 버전의 release 산출물을 지운다**(데이터·프로젝트·내보내기는 보존). 미지정이면 지금까지처럼 모든 release를 보존해 롤백 여지를 남긴다.

commit → push → 웹 호스트의 전용 Git 저장소 fetch → exact commit release worktree 순서로만 소스를 전달한다. `node scripts/web/deploy-web-host.mjs <sha>`는 current/release의 tracked 및 untracked dirty 상태와 포트를 검사하고, clean release에서 install/build한 뒤 이 fork가 관리하는 unit과 current만 전환한다. 기존 unit과 Tailscale 경로는 변경하지 않는다. dirty checkout을 reset/clean/덮어쓰지 않는다.

개인 배포 예시(`user@host`, tailnet HTTPS):

```sh
NOMI_WEB_RELEASE_DIR=/home/you/apps/nomi-web \
NOMI_WEB_DATA_DIR=/home/you/nomi-web-data \
NOMI_WEB_ORIGIN=https://host.tailnet.example:8445 \
NOMI_WEB_COMFYUI_SSH=user@host \
node scripts/web/deploy-web-host.mjs <40자리 commit>
```

최초 모델 등록은 `scripts/web/seed-local-comfyui.mjs`가 검증된 auth-none ComfyUI 선언만 읽어 새 profile로 복사한다. API 키는 복사하지 않으며 원본 catalog를 쓰지 않는다. 이미 존재하는 웹 catalog도 덮어쓰지 않는다.

```sh
node scripts/web/seed-local-comfyui.mjs /read-only/model-catalog.json "$NOMI_WEB_DATA_DIR" VERIFIED_MODEL_KEY http://127.0.0.1:19188
```

별도 HTTPS 경로는 충돌 여부를 확인한 후 `tailscale serve --bg --https=<port> http://127.0.0.1:<web port>`으로 추가한다. 전체 Serve reset이나 Funnel은 사용하지 않는다. `NOMI_WEB_ORIGIN`이 정확한 Host/Origin 경계다. 개인 tailnet의 접근 제어를 사용하며 공개 인터넷 서비스를 위한 계정 시스템은 없다.

롤백은 새 웹 unit을 정지하거나, 보존된 clean 이전 release로 current를 전환하고 `runtime.env`의 build SHA를 맞춘 뒤 새 웹 서비스만 재시작한다. 데이터와 이전 releases는 삭제하지 않는다.

## 검증

`pnpm run test:web`, `pnpm exec tsc -p tsconfig.web.json`, `pnpm run build:web`가 웹 계약 검사다. 기존 gates와 CI도 수행한다. GPU가 없는 CI의 통과는 실제 생성 검증을 대신하지 않는다. 생성 중 탭 종료/재접속, 후보 선택과 별도 컷 교체, 전체 preview 및 MP4의 프레임·오디오·순서, export 중 탭 종료와 서비스 재시작을 실제 자원으로 검증해야 한다.

초기 구현에서 사용자가 승인한 기존 로컬 시각 gate 예외와 설계/검증 조건은 [설계 카드](plan/2026-10-12-personal-web.md)에 기록한다. 이 예외는 다른 기능/타입/CI/실제 GPU 검사에 적용하지 않는다.

## fork의 CI 설정

이 fork의 기본 `GITHUB_TOKEN` 권한은 `read`다. 기존 docs/archetype/site 자동 동기화는 workflow에 선언한 `pull-requests: write`와 저장소의 PR 생성·승인 허용 설정을 사용한다. 새 fork에서 이 설정이 꺼져 있으면 문서 검사는 성공해도 자동 PR 생성이 실패한다. `Leonamin/nomi-web`은 `can_approve_pull_request_reviews=true`로 설정하고 실패한 문서 workflow의 재실행 성공을 확인했다. 자동 합입은 별도 설정하지 않았다. [GitHub repository workflow permission API](https://docs.github.com/en/rest/actions/permissions#set-default-workflow-permissions-for-a-repository).

상속된 upstream 계획은 이 개인용 fork의 진행 중 작업을 뜻하지 않는다. 자동 문서 색인에 등록할 때 참고 기록으로 표시하고, 개인용 웹의 승인·구현·실제 검증 기록은 해당 설계 카드와 QA 보고서에서 확인한다.

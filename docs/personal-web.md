# Nomi 개인용 웹 버전

이 fork는 실제 검증한 upstream v0.23.1 (`66d6eafed07ad6239acd765dd05c9eb0870cf849`)의 UI, 프로젝트 형식, 후보, 타임라인과 FFmpeg 내보내기를 사용한다. 브라우저는 기존 preload 계약을 HTTP로 호출하며 Electron/noVNC를 실행하지 않는다.

수동 ComfyUI 생성과 서버 MP4 내보내기는 브라우저 수명과 분리된다. 수락 전 intent와 수락한 prompt ID를 별도 작업 파일에 기록한다. 재접속 중에는 서버의 작업 상태를 조회한다. 서버가 재시작되면 수락한 생성은 같은 prompt ID를 다시 조회하며, 수락 여부가 불명확한 요청은 자동 재제출하지 않는다. 진행 중 export의 서비스 재시작은 기존 export manager가 중단 실패로 회수하고 사용자가 새 내보내기를 시작한다. 완료된 파일은 보존된다.

후보 선택은 노드의 현재 후보만 바꾼다. 이미 배치한 컷은 별도 **Replace shot / 替换镜头** 버튼으로 교체한다. 순서, 배치, source in-point, 보이는 길이, framing과 audio 설정을 유지한다. 새 소스가 이 구간보다 짧으면 전체 교체를 거절한다. 타임라인 교체는 undo할 수 있다.

TTS, AI Agent 제작/자동 검증·재생성, 결제 및 다중 사용자 SaaS는 제공하지 않는다. 생성 RPC는 auth-none 로컬 ComfyUI와 지원된 이미지/영상 작업만 허용한다. 브라우저 녹화가 필요한 export backend는 서버에서 명확하게 거절한다. 타임라인의 일반 영상·이미지·오디오 FFmpeg 경로를 사용한다.

## 실행

Node 24와 저장소에 지정한 pnpm을 사용한다. 서버에도 전체 의존성을 설치한다. 웹의 Hono는 원래 Electron 설치 패키지에 추가되지 않도록 devDependencies에 둔다.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:web
NOMI_WEB_DATA_DIR=/absolute/dedicated/data NOMI_WEB_PORT=9031 corepack pnpm run start:web
```

`NOMI_WEB_DATA_DIR`는 기존 desktop 데이터와 분리된 실제 디렉터리여야 한다. symlink 데이터 루트/설정/프로젝트 루트를 거절한다. 프로젝트·assets·exports는 이 루트 아래에만 만들어진다. 정적 파일은 `dist/web/client`에 한정하고 미디어는 기존 owned-file/range 경계를 사용한다. 공개 소스 `/source`는 실행한 `NOMI_BUILD_SHA`를 가리키며 설정의 About에도 소스와 AGPL 링크가 있다.

## hamsbox 운영

- 코드: `/home/leonamin/apps/nomi-web/releases/<40자리 commit>`, `current` symlink
- 데이터: `/home/leonamin/nomi-web-data`
- 서비스: `nomi-web.service`, `nomi-web-comfyui.service` (user systemd)
- 웹: `127.0.0.1:9031`, Tailscale 내부 HTTPS 8445
- 별도 GPU 터널: `127.0.0.1:19188` → SSH leo → `127.0.0.1:8188`

commit → push → hamsbox의 전용 Git 저장소 fetch → exact commit release worktree 순서로만 소스를 전달한다. `node scripts/web/deploy-hamsbox.mjs <sha>`는 current/release의 tracked 및 untracked dirty 상태와 포트를 검사하고, clean release에서 install/build한 뒤 이 fork가 관리하는 unit과 current만 전환한다. 기존 Nomi/Japonica unit과 Tailscale 경로는 변경하지 않는다. dirty checkout을 reset/clean/덮어쓰지 않는다.

최초 모델 등록은 `scripts/web/seed-local-comfyui.mjs`가 검증된 auth-none ComfyUI 선언만 읽어 새 profile로 복사한다. API 키는 복사하지 않으며 원본 catalog를 쓰지 않는다. 이미 존재하는 웹 catalog도 덮어쓰지 않는다.

```sh
node scripts/web/seed-local-comfyui.mjs /read-only/model-catalog.json /home/leonamin/nomi-web-data VERIFIED_MODEL_KEY http://127.0.0.1:19188
```

별도 HTTPS 경로는 충돌 여부를 확인한 후 `tailscale serve --bg --https=8445 http://127.0.0.1:9031`으로 추가한다. 전체 Serve reset이나 Funnel은 사용하지 않는다. `NOMI_WEB_ORIGIN=https://hamsbox.badger-viper.ts.net:8445`가 정확한 Host/Origin 경계다. 개인 tailnet의 접근 제어를 사용하며 공개 인터넷 서비스를 위한 계정 시스템은 없다.

롤백은 새 웹 unit을 정지하거나, 보존된 clean 이전 release로 current를 전환하고 `runtime.env`의 build SHA를 맞춘 뒤 새 웹 서비스만 재시작한다. 데이터와 이전 releases는 삭제하지 않는다.

## 검증

`pnpm run test:web`, `pnpm exec tsc -p tsconfig.web.json`, `pnpm run build:web`가 웹 계약 검사다. 기존 gates와 CI도 수행한다. GPU가 없는 CI의 통과는 실제 생성 검증을 대신하지 않는다. 생성 중 탭 종료/재접속, 후보 선택과 별도 컷 교체, 전체 preview 및 MP4의 프레임·오디오·순서, export 중 탭 종료와 서비스 재시작을 실제 자원으로 검증해야 한다.

초기 구현에서 사용자가 승인한 기존 로컬 시각 gate 예외와 설계/검증 조건은 [설계 카드](plan/2026-10-12-personal-web.md)에 기록한다. 이 예외는 다른 기능/타입/CI/실제 GPU 검사에 적용하지 않는다.

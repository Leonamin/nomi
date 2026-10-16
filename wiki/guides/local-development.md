---
type: Guide
title: "로컬 개발과 기본 확인"
description: "Nomi 저장소의 데스크톱·웹 개발 실행과 변경 위험에 맞는 로컬 검사"
scope: "wiki/guides"
okf_version: "0.1"
---

# 로컬 개발과 기본 확인

Nomi는 Electron과 React 기반 데스크톱 앱이며, 별도 Hono 서버를 사용하는 개인용 웹 실행 경로도 제공한다. 로컬 빌드가 성공했다는 사실은 호스트 배포나 실제 GPU 제작 성공을 뜻하지 않는다.

## 환경 준비

저장소의 `package.json`은 Node `>=22.19.0`, pnpm `10.8.1`을 지정한다. lockfile과 package manager 지정을 함께 사용한다.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

`pnpm dev`는 Vite와 Electron을 함께 실행한다. renderer만 확인할 때는 `pnpm run dev:renderer`를 쓴다. 빌드는 `pnpm run build`이며 Vite renderer와 Electron TypeScript 산출물을 만든다.

## 개인용 웹 개발

웹 서버 실행에는 빌드 산출물과 별도 데이터 루트가 필요하다. 기존 데스크톱 데이터 폴더와 분리된 전용 경로를 지정한다.

```sh
corepack pnpm run build:web
NOMI_WEB_DATA_DIR=/absolute/path/to/nomi-web-data \
NOMI_WEB_PORT=9031 \
corepack pnpm run start:web
```

실제 호스트는 올바른 `NOMI_WEB_ORIGIN`도 지정해야 한다. 앱은 Host/Origin 경계를 사용하고 저장 위치와 웹 포트를 환경에서 읽는다. 비밀 값이나 개인 장비 경로를 소스 문서에 복사하지 않는다.

## 검사 고르기

`pnpm run gates`는 저장소의 위험 분류에 따라 관련 계약·테스트·빌드를 실행한다. `pnpm run gates:full`은 전체 로컬 테스트 tier까지 실행한다. 웹 실행 경로를 바꾸면 웹 계약 검사로 `pnpm run test:web`, `pnpm exec tsc -p tsconfig.web.json --noEmit`, `pnpm run build:web`가 정의돼 있다. 이 명령들이 통과해도 외부 provider, GPU, 브라우저의 실제 미디어, 배포 호스트를 검증한 것은 아니다.

작업 시작 전 기준 브랜치와 worktree 상태를 확인하고 저장소 정책의 `pnpm run delivery:preflight`를 따른다. 구체적인 위험별 실행 조건은 [명령 표](../../docs/engineering/commands.md)와 [전달·검증 안내](delivery-and-validation.md)를 참조한다.

## 근거와 확인일

- 확인일: 2026-10-16
- 코드 근거: [`package.json`](../../package.json), [`scripts/web/deploy-web-host.mjs`](../../scripts/web/deploy-web-host.mjs)
- 절차 근거: [`docs/engineering/commands.md`](../../docs/engineering/commands.md), [`docs/personal-web.md`](../../docs/archive/guides/personal-web.md)

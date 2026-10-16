---
type: Decision
title: "ADR 0001: 개인용 웹 우선 fork와 소유 경계"
description: "개인용 Nomi Web을 우선하고 fork 전용 변경을 전용 경로에 둔다"
scope: "decisions/0001-web-first-fork"
okf_version: "0.1"
status: "accepted"
---

# ADR 0001: 개인용 웹 우선 fork와 소유 경계

- 상태: 채택
- 결정일: 2026-10-13

## 맥락

사용자는 2026-10-12 검증된 upstream v0.23.1 커밋을 새 fork의 초기 기준으로 승인했고, 다음 날 fork를 개인용 Web 우선으로 유지하며 upstream과 공유되는 코드는 일반적인 개선에 한정하는 경계를 결정했다. 최신 upstream 커밋을 초기 기준으로 삼으면 기존 검증 기준과 큰 차이가 생긴다는 근거가 설계 기록에 남아 있다.

## 결정

이 fork는 개인용 Web 버전을 우선한다. fork 전용 웹 호스트·배포 코드는 `web/`, `scripts/web/`에 둔다. 공유 경로 변경은 fork 전용 분기를 끼워 넣지 않고 upstream에도 유효한 일반 변경인지 먼저 살핀다. upstream 이력과 동기화 경로는 유지한다. `CLAUDE.md`/`AGENTS.md`는 중립을 유지하고 web-first 경계는 fork 경계 문서에 둔다.

## 결과

웹 호스트는 Electron/noVNC 화면 전송 대신 브라우저 UI와 제한된 서버 capability로 구현된다. fork 전용 정책과 운영은 전용 문서에 기록한다. 승인 당시의 제품 범위는 현재 지원 상태를 자동으로 보증하지 않으며, 기능별 현재 상태는 코드·최근 QA를 확인한다.

## 근거

- 사용자의 초기 기준 승인과 범위: [2026-10-12 개인용 웹 설계·실제 검증 계획](../../docs/plan/2026-10-12-personal-web.md)
- 사용자 결정이라고 명시된 경계: [docs/fork-boundary.md](../../docs/fork-boundary.md)
- 현재 구현 경계: [web/server.ts](../../web/server.ts), [web/rpc.ts](../../web/rpc.ts)
- 확인일: 2026-10-16

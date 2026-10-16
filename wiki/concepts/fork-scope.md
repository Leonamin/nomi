---
type: Concept
title: "현재 fork의 제품 범위와 소유 경계"
description: "개인용 Nomi Web fork가 상속한 기준과 fork 전용 코드의 위치"
scope: "concepts/fork-scope"
okf_version: "0.1"
---

# 현재 fork의 제품 범위와 소유 경계

현재 저장소는 upstream Nomi의 검증된 v0.23.1 커밋 `66d6eafed07ad6239acd765dd05c9eb0870cf849`를 초기 기준으로 삼은 개인용 웹 우선 fork다. 이 기준은 최신 upstream을 뜻하지 않는다. upstream 공통 이력은 유지하면서 개인용 브라우저 호스트와 운영 경로를 별도로 둔다.

fork 전용 웹 호스트와 웹 전개 코드는 `web/`, `scripts/web/`에 있다. 한국어 번역과 fork 운영 안내도 별도 경로로 관리한다. `src/`, `electron/`의 기존 구현 대부분과 빌드·의존성 파일은 upstream과 공유하므로, fork 전용 요구는 우선 fork 소유 경계에 두고 공유 코드 변경은 upstream에도 유효한 일반 동작인지 검토한다. `CLAUDE.md`/`AGENTS.md`는 web-first 기준으로 바꾸지 않는다.

## 근거와 확인일

- 경계 문서: [docs/fork-boundary.md](../../docs/archive/guides/fork-boundary.md)
- 초기 기준 및 사용자 승인 기록: [개인용 웹 설계·검증 계획](../../docs/archive/plan/2026-10-12-personal-web.md)
- 웹 호스트 구현: [web/server.ts](../../web/server.ts), [web/rpc.ts](../../web/rpc.ts)
- 확인일: 2026-10-16. 제품 범위는 현재 코드와 fork 문서에서 확인했다. 이후 upstream 동기화로 달라질 수 있다.

---
type: Concept
title: "웹 호스트와 desktop capability 경계"
description: "브라우저 UI와 서버 런타임이 맡는 일 및 웹에서 제외된 desktop 기능"
scope: "concepts/web-host"
okf_version: "0.1"
---

# 웹 호스트와 desktop capability 경계

웹 버전은 Electron 화면을 원격 전송하거나 noVNC를 띄우지 않는다. 기존 React 화면을 브라우저에서 렌더링하고, Hono/Node 서버가 제한된 RPC, 프로젝트 저장, 생성 작업, 미디어 전달과 FFmpeg 내보내기를 제공한다. 웹 프로젝트의 데이터 루트는 desktop 데이터와 분리된 `NOMI_WEB_DATA_DIR`로 설정한다.

서버는 loopback에 바인딩하며 요청의 Host/Origin을 `NOMI_WEB_ORIGIN`과 대조한다. RPC는 등록된 채널만 dispatch하고 웹 표면별 프로젝트 권한을 확인한다. 따라서 preload의 모든 native 기능이 웹에 자동으로 노출되는 구조가 아니다. 예를 들어 OS 경로 선택·열기, 임의 파일 조작, 스크린샷, trace 폴더 열기, 내장 skill 목록은 웹 capability에서 제외된다. 업로드·프로젝트 미디어 URL은 별도 소유 경계를 사용한다.

내보내기는 서버 FFmpeg filtergraph 경로만 허용한다. browser recording이 필요한 backend는 요청 초기에 거절한다. 실제로 처리할 수 있는 편집 조합과 플랫폼은 기능별로 다를 수 있으므로 기능별 QA를 함께 확인한다.

## 근거와 확인일

- 구현: [web/server.ts](../../web/server.ts), [web/rpc.ts](../../web/rpc.ts), [web/hostCapabilities.ts](../../web/hostCapabilities.ts)
- 운영 경계: [docs/personal-web.md](../../docs/personal-web.md)
- 최근 제한 기능의 브라우저 확인: [2026-10-15 Web platform/media QA](../../docs/qa/2026-10-15-web-platform-media-browser.md)
- 확인일: 2026-10-16. 코드 경로는 확인했으나 모든 OS·편집 조합을 실사용 검증한 기록은 아니다.

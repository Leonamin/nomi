---
type: Concept
title: "프로젝트에서 타임라인 내보내기까지"
description: "프로젝트 원본, 생성 후보와 편집된 타임라인의 관계"
scope: "concepts/creation-flow"
okf_version: "0.1"
---

# 프로젝트에서 타임라인 내보내기까지

일반 흐름은 프로젝트를 열거나 만들고, 생성 캔버스에서 프롬프트와 실행 대상을 정한 뒤, 생성 결과를 후보로 검토하고, 선택한 소스를 타임라인 컷에 배치해 미리보기와 내보내기를 진행하는 순서다. 프로젝트와 생성 작업·자산은 서버의 전용 웹 데이터 경계에 저장된다. 브라우저 연결은 편집 요청과 표시를 담당한다.

후보 선택은 노드의 현재 후보를 바꾼다. 이미 타임라인에 배치된 컷은 그 선택만으로 자동 교체되지 않는다. 컷 교체는 별도 명령이며 기존 순서·배치·트림 등 보존 규칙을 따른다. 타임라인을 내보낼 때 서버가 지원하지 않는 렌더 backend를 선택하면 웹 호스트는 browser recording으로 대체하지 않고 거절한다.

프로젝트 화면 구조와 각 편집 기능은 변하고 있으므로, 이 문서는 개념 관계를 설명한다. 구체적인 사용 절차는 별도 사용자 안내와 실제 화면을 기준으로 한다.

## 근거와 확인일

- 프로젝트 생성·저장·선택: [web/rpc.ts](../../web/rpc.ts), [web/projectState.ts](../../web/projectState.ts)
- 생성 및 결과 수집: [web/generationJobs.ts](../../web/generationJobs.ts), [web/comfyuiProductionProvider.ts](../../web/comfyuiProductionProvider.ts)
- 컷 후보와 교체 결정의 승인 기록: [docs/plan/2026-10-12-personal-web.md](../../docs/plan/2026-10-12-personal-web.md)
- 내보내기 backend 경계: [web/rpc.ts](../../web/rpc.ts)
- 최근 실제 웹 미디어 확인과 한계: [2026-10-15 Web platform/media QA](../../docs/qa/2026-10-15-web-platform-media-browser.md)
- 확인일: 2026-10-16. 프로젝트/생성·내보내기 경로 코드를 확인했다. 최근 QA는 생성 결과 복원과 asset 재생·업로드는 확인했으나 전체 타임라인 export는 확인하지 않았다.

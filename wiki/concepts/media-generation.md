---
type: Concept
title: "웹 미디어 생성과 음성 지원 경계"
description: "웹에서 확인된 생성 provider 범위와 TTS 관련 사실을 구분"
scope: "concepts/media-generation"
okf_version: "0.1"
---

# 웹 미디어 생성과 음성 지원 경계

웹의 production-run provider는 현재 enabled 상태이고 인증 방식이 `none`인 ComfyUI 연결 중, 실행 가능한 모델이 등록된 provider만 구성한다. production provider의 명시적 작업 모드는 text-to-image, image-edit, text-to-video, image-to-video 네 가지다. 실행은 승인된 payload와 생성 권한 경계를 통과한다.

저장소 전체에는 오디오 결과·오디오 길이·타임라인 오디오 클립을 처리하는 코드와 여러 TTS 모델 archetype이 있다. 이것만으로 웹에서 TTS를 생성할 수 있다고 결론 내릴 수 없다. 확인한 웹 production-run 경로는 TTS 작업 모드를 받지 않는다. 반대로 프로젝트에 이미 있는 오디오 자산을 웹 타임라인에서 다루는 지원은 생성 지원과 별개의 기능이다. 웹에서 다른 오디오 생성 진입점이 추가됐는지는 현재 검토 범위의 RPC와 provider만으로 확인하지 못했다.

따라서 과거 안내의 “TTS 미제공”은 웹 production provider 경계에 한해서는 일치하지만, Nomi 전체가 TTS를 지원하지 않는다는 뜻으로 확장하면 부정확하다. 2026-10-15의 오디오 타임라인 코드는 기존 오디오 생성 결과를 타임라인에 추가하는 데이터 처리 동작을 검토했으며, 그 보고서는 live browser/export acceptance가 아니다.

## 근거와 확인일

- 웹 provider 허용 모드: [web/comfyuiProductionProvider.ts](../../web/comfyuiProductionProvider.ts)
- 웹의 provider 구성 및 generation RPC: [web/productionHost.ts](../../web/productionHost.ts), [web/rpc.ts](../../web/rpc.ts)
- TTS 모델 archetype 예: [electron/shared/modelArchetypes/doubaoTtsArchetype.ts](../../electron/shared/modelArchetypes/doubaoTtsArchetype.ts), [electron/shared/modelArchetypes/seedTtsArchetype.ts](../../electron/shared/modelArchetypes/seedTtsArchetype.ts)
- 오디오 결과의 타임라인 처리 코드 검토: [2026-10-15 generated audio timeline review](../../docs/qa/2026-10-15-generated-audio-timeline-review.md)
- 확인일: 2026-10-16. TTS를 웹 UI에서 실제 생성하는 브라우저 검증 증거는 확인하지 못했다.

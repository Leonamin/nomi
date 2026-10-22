---
type: Concept
title: "캔버스에서 로컬 ComfyUI로 영상 만들기"
description: "MiniMax H3 Ref2VA로 캔버스에서 영상을 직접 생성하는 절차, 실측값, 알려진 한계와 남은 후보"
scope: "concepts/canvas-video-generation"
okf_version: "0.1"
---

# 캔버스에서 로컬 ComfyUI로 영상 만들기

개인용 웹 호스트(hamsbox)의 로컬 ComfyUI(RTX 5080, 16GB)로 이미지→영상을 캔버스에서 직접 만드는 방법과, 2026-10-20~22 실사용에서 확인한 값·한계를 모은다. 새 영상 작업을 시작하는 세션은 이 문서부터 읽는다. 등록된 워크플로를 건드리기 전에는 [ComfyUI 워크플로 등록](comfyui-workflow-registration.md)을 먼저 읽는다.

## 쓸 수 있는 모델 (2026-10-22 카탈로그 기준)

- 영상: MiniMax H3 **Ref2VA**(참조 이미지→영상+음성, `comfy-minimax-h3-ref2va-mvg8tr05`), MiniMax H3 **FL2VA**(첫·끝 프레임→영상+음성, `comfy-minimax-h3-fl2va-mvgdlxny`). 사용자가 Wan2.2를 쓰지 않기로 해서 새 작업은 H3를 쓴다. Wan2.2 이미지→영상은 등록돼 있다.
- 이미지: Flux2 Klein(참조 이미지 편집, 얼굴 일관성에 사용), Qwen Image 2.1(API 형식 JSON으로 등록, 참조 이미지를 받지 못함).
- 모델 목록은 서버의 `model-catalog.json`이 정본이고 화면의 설정 > 모델 목록이 더 늦을 수 있다. 목록이 이상하면 카탈로그 파일을 읽기 전용으로 확인한다.

## 캔버스에서 만드는 절차 (2026-10-22 실서버 확인)

1. 새 영상 노드를 만든다. 모델 선택창에 이미지→영상 모델(Wan2.2, H3 FL2VA, H3 Ref2VA)이 텍스트→영상 모델과 함께 보인다(PR #47 이후).
2. H3 Ref2VA를 고르면 프롬프트 바 위에 참조 이미지 "+" 슬롯이 생긴다. 슬롯을 눌러 프로젝트 이미지를 고르면 거부 없이 붙고 연결선이 생긴다.
3. 프롬프트를 쓰고 생성한다. 한 컷에 GPU 약 2.3~2.5분이 걸린다. 화면 비율은 기본 `auto`.

AI 패널(Claude 엔진)로도 만들 수 있다. 이때 Claude는 이미지 키프레임에 Flux2 Klein을, 영상에 H3 Ref2VA를 골랐다. 이름만으로 노드를 못 찾는 경우가 있어 파일명으로 지정해야 했다.

## 실측값

- 이미지: Flux2 Klein 1360x768(16:9 프로젝트에서 `auto`), 컷당 약 100초(4장 묶음 약 40초).
- 영상: H3 Ref2VA 864x480, 24fps, 5.17초, h264 + AAC 오디오(평균 약 -15~-20 dB). 메모리 부족·시간 초과는 한 번도 없었다.
- 내보내기: 1920x1080 h264. 864x480은 1.8:1이라 16:9(1.778:1)와 달라 위아래에 약 6~8픽셀의 흰 줄이 생길 수 있다. 큰 양옆 여백은 이미지·영상 소재 비율 수정([비율 문서](comfyui-output-aspect.md))으로 사라졌다.
- 영상은 프롬프트에 적은 언어로 말한다. 영어 프롬프트("says hello")로 만든 클립은 영어로 말했다. 한국어로 말하게 하려면 프롬프트에 "speaks in Korean"을 명시한다.

## 대사와 말투

기획서와 샷 초안에서 대사를 쓸 때 화자별 말투를 한 줄로 보이게 하고 샷 사이에 유지하라는 도구 지침이 있다(PR #50, 2026-10-22 배포). 어떤 말투를 고를지는 정하지 않는다. 효과는 아직 새 프로젝트로 확인하지 못했다. 이 지침 전에 만든 VLOG 영상은 샷마다 말투가 달랐다(반말과 존댓말 혼재).

## 알려진 한계

- 연결선 라벨이 모델과 무관하게 "First frame"으로 보인다. 워크플로 가져오기가 이미지 입력이 하나면 첫 프레임으로 추정하도록 만들어져 있어서이고(`comfyuiWorkflowImport.ts`), 생성 동작에는 영향이 없었다. 고치려면 분류 변경이나 역할 선택 화면이 필요해 하지 않았다.
- 생성 직후 진행률이 절반 가까이로 뜨던 문제는 캐시된 노드를 분모에서 빼도록 고쳐 배포했다(PR #48). 실제 생성 중 표시는 확인하지 못했다.
- Claude 엔진은 타임라인을 읽거나 고치지 못한다. 클립은 "타임라인에 추가" 버튼으로 직접 넣었고, 버튼이 영상 요소에 가려져 일반 클릭이 거절되는 경우가 있었다.
- AI 패널이 영상 생성이 끝난 뒤에도 "생성 중"에 머물 수 있다(새로고침으로 풀림). 새 영상이 자산 라이브러리에 원본과 `materialized/` 복사본으로 두 번 보인다. 낮은 배율에서 새 영상이 빈 흰 프레임으로 보인다.
- 한 번 만든 영상의 말투는 바뀌지 않는다. 다시 만들려면 컷마다 GPU 약 2.5분이 든다.

## 남은 후보 (요청 전까지 시작하지 않음)

- H3 영상 크기를 16:9에 더 가깝게: 흰 줄 제거. 크기를 키우면 생성 시간이 늘 수 있어 먼저 시간과 메모리를 잰다.
- 프로젝트 정리: "마인크래프트 VLOG"의 빈 테스트 노드와 빈 공급자(`comfyui-local--candidate-0b15f81a14d6bd98`). 공급자 삭제는 계보 전체를 지우므로 UI의 모델 단위 삭제만 쓴다.
- 서버 부하 추가 절감: [웹 서버 부하](web-server-load.md) 참고.
- 0.24 정식 릴리스 시 업스트림 따라잡기: [ADR 0003](../decisions/0003-upstream-cherry-pick-sync.md).

## 근거와 확인일 (2026-10-22)

- 코드: [defaultNodeModelSelection.ts](../../src/workbench/generationCanvas/nodes/defaultNodeModelSelection.ts), [modelOptionsAdapter.ts](../../src/workbench/generationCanvas/adapters/modelOptionsAdapter.ts)(영상 선택창은 영상류 발행 모델 전부 조회), [comfyuiProgressSocket.ts](../../electron/comfyuiProgressSocket.ts), [generationPromptGuidance.ts](../../electron/shared/agentCapabilities/generationPromptGuidance.ts).
- 실서버 확인: PR #47(선택창·참조 슬롯 화면 확인, H3 Ref2VA 캔버스 직접 생성 1건 성공), 같은 날 VLOG 5샷 생성·내보내기. 영상 해상도와 길이는 `ffprobe`로 확인했다.
- 확인하지 못한 것: 참조 이미지와 결과 인물을 나란히 놓은 비교(썸네일 눈대중), H3 오디오 내용이 대사와 맞는지(듣지 않음), PR #48·#50의 실제 효과.

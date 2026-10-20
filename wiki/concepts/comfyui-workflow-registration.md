---
type: Concept
title: "ComfyUI 워크플로 등록과 가져오기 삭제 사고"
description: "워크플로 가져오기가 게시된 등록을 계보 전체 삭제로 지운 2026-10-20 사고의 원인·재발 위험·복구 방법"
scope: "concepts/comfyui-workflow-registration"
okf_version: "0.1"
---

# ComfyUI 워크플로 등록과 가져오기 삭제 사고

2026-10-20 개인용 웹 호스트에서 새 ComfyUI 워크플로를 가져오자, 이미 게시돼 쓰이던 등록 3개(Qwen Image 2.1, Wan2.2 이미지→영상, Flux2 Klein 참조 편집)가 모델 카탈로그에서 통째로 사라졌다. 비활성이 아니라 공급자·모델·매핑이 삭제됐다. 이 문서는 확인한 사실과 추정을 구분해 기록한다.

## 증상

- 설정 > 모델 목록의 ComfyUI 모델이 5개로 줄었다: 새로 가져온 MiniMax H3 FL2VA·Ref2VA, 내장 문생도(비활성), Local SD1.5 image, Leo H3 manual video. 이전에 보이던 Qwen·Wan·Klein은 없다.
- 사라지기 직전(05:10, 05:22)에는 화면에서 Qwen과 Wan이 보였다. 시각은 호스트 기준 2026-10-20이다.
- 삭제 순간을 직접 본 기록은 없다. 서버 로그는 카탈로그 쓰기를 남기지 않고, 이전 백업은 2026-10-13 이전이다.

## 원인 (코드 읽기로 확인, 연결 체인은 현재 카탈로그 상태에서 추정)

- **직접 원인:** `stageComfyWorkflow`가 `identity.supersededVendorKeys`의 각 공급자에 `tx.deleteVendor`를 호출한다([comfyuiWorkflowImportStore.ts](../../electron/catalog/comfyuiWorkflowImportStore.ts) 285~287행 부근). 이 목록은 같은 루트 `comfyui-local` 아래의 미게시 후보 전부로 채워지며 모델·워크플로로 거르지 않는다([stagedVendorIdentity.ts](../../electron/catalog/stagedVendorIdentity.ts) 211~220행 부근). `deleteVendor`는 계보의 하위 공급자까지 함께 지운다([catalogStore.ts](../../electron/catalog/catalogStore.ts), [vendorLineageLifecycle.ts](../../electron/catalog/vendorLineageLifecycle.ts)).
- **하위가 살아 있던 이유:** 새 가져오기의 출처 공급자는 baseUrl이 같은 첫 ComfyUI 공급자이고([integrationSession.ts](../../electron/integrationCertification/integrationSession.ts) 약 363~370행 `certifyComfy`), 새 공급자가 배열 맨 앞에 들어간다. 그래서 가져올 때마다 직전 후보 아래로 한 줄 연결된다. 현재 카탈로그에서 Ref2VA는 FL2VA 아래, FL2VA는 루트 아래에 있다.
- **방아쇠:** 이미 게시된 워크플로를 다시 저장하면 새 판이 게시되고 이전 판 공급자는 비활성이 된다([serviceCatalog.ts](../../electron/providerAdapter/serviceCatalog.ts) 380~383행 부근). 이 비활성 공급자가 하위에 살아 있는 등록을 매단 채 "미게시 후보"로 취급돼, 다음 가져오기 때 계보 전체가 삭제된다. 이날 Qwen 워크플로를 한 번 다시 저장한 것이 이 상태를 만들었다.
- **기각한 가설:** 오래된 메모리의 덮어쓰기, 자체 점검 취소·시간 초과, 05:02 배포 시 마이그레이션. 카탈로그 쓰기는 매번 디스크를 새로 읽고, 두 새 실행은 자체 점검을 마치고 게시됐다.
- **구조적 원인:** 두 불변식이 없다. ① 대체는 같은 모델·같은 판의 껍데기만 지워야 하고 계보 전체를 지우면 안 된다. ② 서로 무관한 워크플로가 출처 간선으로 연결되면 안 된다. 삭제 함수가 게시된 모델을 가진 공급자를 막지도 않는다.
- 업스트림(aqm857886159/Nomi main, 2026-10-19 기준)은 이 파일들을 바꾼 적이 없어서 같은 결함이 있을 수 있다. 확인한 것은 변경 이력 없음까지다.

## 재발 위험과 수정 (2026-10-20 병합·배포·실서버 확인)

- **삭제 사고 수정 (PR #44, 병합 `dff50ac5d`):** 대체는 하위가 없고 게시된 모델이 없으며 다시 올리는 모델만 가진 빈 껍데기에 한한다. 새 워크플로의 출처는 그 모델의 이전 판, 없으면 가장 최근 게시된 선택 모델의 공급자, 그것도 없으면 루트다. `deleteVendor`는 게시된 모델이 있는 계보를 지우지 못한다. 이미 연결된 구조(Ref2VA→FL2VA)는 마이그레이션 없이 삭제 대상에서 제외된다. 사용자 삭제 경로(`deleteModelCatalogVendor`)는 그대로이므로 공급자 단위 삭제는 계보 전체를 지울 수 있어 쓰지 않는다. 모델 단위 삭제만 쓴다.
- **덮어쓰기 사고 (두 번째 결함, PR #45, 병합 `59a016691`):** 편집 없이 "Workflow settings → Save"를 하면 그 워크플로의 모델 키를 단 연결 세션이 시작되지 않은 채 남고, 같은 주소의 다음 새 가져오기가 그 세션을 재사용했다. 재사용한 세션이 요청에 모델 키가 없어도 예전 키와 이름을 유지해([integrationSession.ts](../../electron/integrationCertification/integrationSession.ts) `submitWorkflow`), 새 워크플로가 "교체"로 처리돼 FL2VA 모델의 내용이 Z-Image 이미지 워크플로로 바뀌었다. 종류가 영상에서 이미지로 바뀌는 교체를 막는 장치도 없었다. 이제 재사용 세션은 항상 현재 요청에서 모델 키·이름을 가져오고, 종류가 바뀌는 교체는 `comfy_workflow_kind_mismatch` 오류로 거절된다. 서버에 남은 오래된 세션도 마이그레이션 없이 안전하다.
- **실서버 확인:** 수정 빌드(`59a016691`)에서 임시 워크플로를 대상으로 같은 순서(편집 없는 저장 → 다른 워크플로 가져오기)를 재현해 새 모델이 만들어지고 저장했던 것이 그대로임을 카탈로그 파일로 확인했다. 단위 테스트는 확인 시점의 가져오기·세션 계층만 덮는다.

## 복구 결과 (2026-10-20)

- 새 모델로 다시 가져와 FL2VA(영상), Wan2.2 이미지→영상, Flux2 Klein 참조 편집, Qwen Image 2.1이 등록·활성 상태다. 모델 키는 새로 발급돼 이전 모델에 묶인 프로젝트 노드는 다시 지정해야 한다.
- 원래 영상 FL2VA 행(비활성)은 UI에 보이지 않는 채 남아 있다. Ref2VA가 그 공급자를 출처로 삼으므로 공급자 단위 삭제로 지우지 않는다.
- Qwen은 ComfyUI UI 형식 JSON으로 가져오면 크기 노드가 서브그래프 안의 연결된 입력이라 가로·세로·화면 비율 컨트롤이 노출되지 않는다. 호스트에 남아 있던 원래 API 형식 워크플로로 다시 가져와 가로·세로와 화면 비율을 노출했다. 서브그래프 방식 모델은 지웠다. 관련 내용은 [ComfyUI 생성물의 화면 비율](comfyui-output-aspect.md) 참고.

## 관련 미해결 사항

- 새로 가져온 MiniMax H3 워크플로에서 Ref2VA의 참조 이미지가 "첫 프레임" 역할로 인식됐고, 두 워크플로 모두 프로젝트 비디오 모델 선택창에 나타나지 않았다. 원인은 확인하지 못했다(복구 후 선택창은 다시 확인하지 않았다).
- 모델 화면을 열 때마다 "자체 점검이 아직 대기 중" 배너가 다시 나타나고 Skip으로 사라지지 않았다. 자체 점검 창은 카탈로그에서 활성이 된 뒤에도 "Loading…"에 머문다. 활성 여부의 신뢰할 수 있는 신호는 카탈로그 파일이었다. 응답이 돌아오지 않는 원인은 확인하지 못했다.
- 새로 붙여넣은 워크플로의 첫 "Analyze workflow" 클릭이 동작하지 않고 좌표 클릭만 됐다. 같은 이름의 "Local ComfyUI · 1 models" 카드가 여럿 보여 구분이 어렵다. 영어 화면에 한자 라벨(重绘幅度, 批量)이 섞여 있다.

## 근거와 확인일 (2026-10-20)

- 읽기 전용 조사: 호스트 `model-catalog.json`·`model-catalog.bak.json`, `capability-core/integration-comfy-operations.json`, 서버 저널, 위 코드 파일. 복구 절차는 수행하지 않았다.
- 화면 확인: 같은 날 UI 탐색 세 건의 스크린샷.

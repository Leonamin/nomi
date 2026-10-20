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

## 재발 위험

높다. 수정 전에는 이미 연결된 Ref2VA→FL2VA 구조가 남아 있어서, FL2VA를 다시 저장한 뒤 무엇이든 가져오면 Ref2VA도 지워질 수 있다. 수정이 배포되기 전에는 ComfyUI 설정에서 워크플로를 저장·가져오기·삭제하지 않는다.

## 복구

- Wan2.2와 Klein: 저장소 [docs/comfyui-workflows](../../docs/comfyui-workflows/README.md)의 API JSON으로 다시 가져온다.
- Qwen: ComfyUI에 저장된 `T2I-Qwen-Image-2-1.json`.
- 원래 필드 매핑·라벨은 호스트 프로필의 `integration-sessions.json`에 남아 있어 거의 그대로 복원할 수 있다.
- 복구할 수 없는 것: 예전 공급자 키·해시·매핑 행, 원래 모델 키(다시 가져오면 새로 발급돼, 옛 모델에 묶인 프로젝트 노드는 연결이 끊기므로 다시 지정해야 한다), 삭제 직전 카탈로그 상태.
- 순서: 수정을 먼저 배포하고 복구한다. 먼저 복구하면 같은 함정이 켜진 채 Qwen이 다음 가져오기의 연결 부모가 된다. 급하면 Wan, Klein, Qwen 순으로 한 번씩만 가져오고 재저장은 하지 않는다.

## 수정 방향 (2026-10-20 진행 중, 병합 전)

가장 앞쪽 공유 경계인 `planStagedVendorIdentity`의 대체 목록 계산과 `certifyComfy`의 출처 선택을 바로잡고, `deleteVendor`에 게시된 모델이 있는 공급자를 지우지 못하게 하는 방어를 둔다. 이미 연결된 현재 구조는 파괴적 마이그레이션 없이 안전해야 한다. 수정 PR은 병합·배포 전이며, 배포 후 실제 앱에서 임시 워크플로를 가져와 다른 등록이 남는지 확인한다.

## 관련 미해결 사항

- 새로 가져온 MiniMax H3 워크플로에서 Ref2VA의 참조 이미지가 "첫 프레임" 역할로 인식됐고, 두 워크플로 모두 프로젝트 비디오 모델 선택창에 나타나지 않았다. 원인은 확인하지 못했다.
- 이 워크플로 가져오기에는 자체 점검이 2~4분 응답 없이 닫히는 현상이 있었다. 두 실행은 이후 게시됐으므로 삭제 사고와는 관계없다고 봤다.

## 근거와 확인일 (2026-10-20)

- 읽기 전용 조사: 호스트 `model-catalog.json`·`model-catalog.bak.json`, `capability-core/integration-comfy-operations.json`, 서버 저널, 위 코드 파일. 복구 절차는 수행하지 않았다.
- 화면 확인: 같은 날 UI 탐색 세 건의 스크린샷.

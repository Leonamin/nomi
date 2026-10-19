# 한국어 독립 검수 B

- 검수 날짜: 2026-10-12
- 검수선: `/root/korean_b`
- 구현선: `/root`
- 대상: `src/i18n/locales/ko/director.json`, `handbook.ts`, `exampleContent.ts`
- 원문: `.tmp/korean-source.json`의 `ui.director`와 `handbook`, 기존 `handbookContent.ts`, `projectTemplates.ts`, `demoProject.ts`

이 보고서는 다른 구현선이 작성한 내용을 검수한 기록이다. 검수자가 번역한 도메인은 검토 대상에서 제외했다. 번역 대상 파일은 수정하지 않았다.

## 발견 사항과 수정 확인

두 가지 의미 오류를 구현선에 전달했고, 수정된 파일에서 모두 확인했다.

1. `director.bottomBar.panoramaImportHint`: 원문의 `equirectangular (2:1)`을 “정방형”으로 안내해 정사각형 이미지를 고르게 할 수 있었다. 현재 “하늘로 사용할 등거리 원통형 파노라마 이미지(2:1)를 고르세요”로 수정되어 원래 화면 비율과 투영 방식을 유지한다.
2. `director.lookAtClip.enablePitch`: “상하 이동 허용”은 위치 이동처럼 읽혔지만, `LookAtClipInspector.tsx`와 `lookAtSolve.ts`의 호출부를 보면 고개의 pitch 회전만 허용한다. 현재 “위아래 바라보기 허용”으로 수정되어 기능과 일치한다.

그 외 중대한 의미 오류나 기술 식별자 손상은 발견하지 못했다.

## 확인 범위

- `director.json` 852개 문구를 영어 원문과 모두 읽고 대조했다. 키 집합과 계층은 같고, 모든 `{{...}}` 보간 값이 일치한다. 파일 형식, 단축키, Wi-Fi·HTTPS·IK·FK 등 기술 식별자와 수치는 의미를 유지한다.
- `handbook.ts`의 데스크톱·웹 안내를 기존 안내와 대조했다. 모델 연결, 참고 카드, 타임라인, 내보내기, 입 모양 맞추기 미지원 안내가 초보자에게 필요한 행동과 제약을 설명한다. 한국어 웹 안내는 직접 ComfyUI 생성과 서버 저장 범위를 명시한다.
- `exampleContent.ts`의 프로젝트 템플릿과 로봇 예제를 기존 예제 및 호출부와 대조했다. `manga-short`·`product-demo`·`free-form`, `kid`·`robot`·`rooftop` 식별자를 유지한다. 장면 8개, 장면 순서, 각각의 길이, 인물·배경 참조 관계와 이야기의 사건 순서를 유지한다.
- 예제·안내 연결부의 diff는 한국어 분기를 추가한다. 기존 영어·중국어 문구를 교체한 부분은 발견하지 않았다. 이 판정은 위 검수 대상과 그 직접 호출부에 한정되며 저장소 전체의 원문 보존 검증을 대신하지 않는다.

## 승인 샘플의 형태 계약

`docs/archive/design/mockups/contracts/2026-10-12-korean-guidance.intent.mjs`는 사용자가 승인한 한국어 문구 샘플의 관계를 기록한다. 초기 화면에서는 시작 행동과 순서 안내를 함께 찾을 수 있고, 설정에서는 한국어가 기존 두 언어와 같은 선택 그룹에 있으며, 안내에서는 행동 제목 뒤에 설명이 나온다.

계약은 초기 화면·설정·안내의 세 상태로 나뉜다. `default`, `settingsContract`, `guideContract`를 해당 샘플 상태에서 각각 `assertMockupContract`로 확인해야 한다. 이 샘플 계약은 실제 앱의 새 레이아웃 승인이나 앱 기능 검증을 뜻하지 않는다.

구현선이 `tests/ux/korean-guidance-sample.walk.mjs`에 계약 import와 실행을 연결했다. 포함 관계의 하위 선택자는 공통 검증기가 상위 선택자 뒤에 결합하는 상대 선택자로 수정했다. 최종 검증 결과는 다음과 같다.

- `node tests/ux/korean-guidance-sample.walk.mjs`: 실제 승인 HTML을 Chromium으로 열고 초기 화면 5개, 언어 선택 3개, 첫 영상 안내 8개의 관계, 총 16개를 통과했다.
- `pnpm run check:mockup-contracts`: 계약 6개 모두 UX walk에 연결되고 현재 샘플과 연결되는 검사 통과. 기존 미작성 샘플 62개의 기준은 바꾸지 않았다.
- 신규 계약의 `node --check`와 두 문서의 `git diff --check`: 통과.

## 한계

문구·구조·직접 호출부를 검수했다. 이 검수에서는 앱 화면의 실제 줄바꿈·잘림, 키보드 조작, 생성 결과와 유료 작업, 실제 내보낸 영상까지 실행하지 않았다. 샘플 승인과 사전 예제는 실제 모델 생성 검증을 대신하지 않는다. 이번 보고서는 원문의 의미를 보존하면서 학생이 다음 행동과 제한을 알 수 있는지에 대한 검수이며, 모든 한국어 문구의 품질을 보증하지 않는다.

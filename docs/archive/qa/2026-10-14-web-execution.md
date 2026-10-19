# Personal web 실행 검증 — 2026-10-14

구현선: web-execution-completion. 검증은 별도 QA 데이터와 로컬 19033 서비스에서 수행. 운영 서비스와 원본 프로젝트 데이터는 변경하지 않음.

## 구현

- 한국어 원문과 제목을 보존하고 생성 모델 입력 언어 안내를 공용 경계에서 적용. 실제 생성 입력은 승인 카드에서 확인.
- 네이티브 OpenCode 2의 공식 CLI·설정 계약과 인증된 임시 서버를 사용. MCP 연결 준비 뒤 실행하고, 동일 대화 재개 및 서버 종료를 검증. 다른 MCP 서버와 파일·셸 도구는 허용하지 않음.
- 모델 선택을 엔진 소유 목록과 함께 갱신하고 오래된 응답을 폐기. 한국어 등 Unicode 대화 이름은 공용 파서에서 검증.
- 원문 storyboard를 소유 데이터로 유지하고 Run에는 파생 해시를 저장. 변경된 원문·참조·파라미터를 승인 전 차단. 후보와 실제 장면 행은 하나의 소유 관계로 원자적으로 갱신.

## 실제 이미지

한국어 요청: 고요한 밤, 붉은 종이등이 어두운 나무 탁자 위에서 은은하게 빛난다.

승인된 모델 입력: On a quiet night, a red paper lantern glows softly on a dark wooden table.

Local SD1.5, 512×512, 20 steps, seed 12345. 완료 Run op-97e5aefc-b83a-4aa8-8a82-87c2675f7e83, 실제 ComfyUI 작업 3856d437-252d-4beb-b67c-7a423456b659. 소재 asset-3643c35e85ef043cb79b, SHA-256 1df234d268a8104d35700a35473cb252248891cbcf827639391b1386fdcac81c. 실제 이미지에서 붉은 종이등과 어두운 탁자를 확인. 다만 추가 종이등이 있으며 정확한 단일 객체 재현은 보장하지 않음.

다른 seed의 밝기 변경 이미지는 객체·위치가 달라 동일성 검증에 실패했으므로 영상 끝 프레임으로 채택하지 않음. 승인한 첫 이미지 하나를 first_frame/last_frame 두 슬롯에 연결해 실제 입력 흐름을 검증. 독립적인 서로 다른 두 이미지의 연속성 품질은 이 검증으로 주장하지 않음.

## 검증 자료

개인 검증 자료: /Users/leonamin/.codex/qa/nomi-web/2026-10-14-execution-completion. 브라우저 승인 카드, 생성 이미지, 실제 engine history 및 소재 해시는 별도 보존. 짧은 수명의 소재 URL·인증 정보·원시 에이전트 로그는 저장소에 포함하지 않음.

## 실제 영상과 재생

원문 기반 Run `op-73ad7706-5026-474d-907e-1f8e777edfb9`, 원문 storyboard 해시 `2b6f5113766ad3163f83523fc769bafe45d9a9e31ca6069dc7914236b2ac0015`. 원문 계획에 keyframe 설정·promptSegments 0–5초·first/last 역할이 남고 실행 후보에는 storyboard 본문이 없음. 실제 ComfyUI 작업 `41ba680b-5b39-4bc2-b38c-153e99f955ea` 성공. MiniMax H3 image-to-video, 20 steps, 640×384, 24fps, 124프레임, MP4 5.167초. 두 LoadImage 노드에 승인한 동일 이미지의 SHA 기반 파일명이 전달됨.

소재 `asset-4665c981145a17026fa1`, 영상 SHA-256 `4195a1001a3d8283c209a62861b103740b8c33ac0c8e69a5f3911a292905b575`. H.264/AAC 파일과 엔진 이력을 대조. 실제 브라우저 플레이어의 20개 시간 샘플이 0.19초부터 4.94초까지 증가하고 ended=true, 종료 시간 5.167초, error=null. 원본 저장 사본도 동일 해시이며 재생 종료 확인. 재생 완료 시 미리보기 닫기는 기존 플레이어 동작.

시작·중간·마지막 프레임을 직접 확인: 붉은 종이등은 유지되지만 마지막 구도가 달라 정확한 고정 카메라 유지나 서로 다른 프레임의 연속성 품질까지 주장하지 않음. 한국어 승인 화면과 중국어·영어 재생 화면을 캡처하고 직접 확인.

GPU 생성 후 발견한 썸네일 표시 오류는 기존 preview DTO 소유자가 목록 응답에서도 thumbnailUrl을 만들도록 수정. 실제 브라우저에서 같은 저장 미리보기 HTTP 경로와 naturalWidth=640을 확인. 소재·sidecar를 재작성하지 않음.

공개 OpenCode 도구의 다른 화면 수정 검증: 구상에서 `op-6cbfcafa-71b6-43a2-b47a-20e9c39487d7` 원문 기반 초안 생성 후 만들기 화면에서 실제 `check_job`·`draft_shots` 호출. canonical promptSegments가 0–5에서 0–4로 변경되고 Run revision=3, 후보와 각 장면에 storyboard 없음, 생성 작업 0개. 실패한 과거 초안·알 수 없는 제출 기록은 보존.

OpenCode 2.0.28은 QA 전용 설치를 사용. 기존 전역 1.18.26을 변경하지 않았으며 지원하지 않는 CLI는 명시적으로 거부. 별도 실제 MCP 두 턴에서 같은 session의 counter-1 → counter-2, 미인증/잘못된 인증 401, 종료 후 프로세스·포트 제거 확인. 제품 웹 대화에서도 동일 OpenCode session으로 실제 이미지·영상·원문 수정 도구를 호출.

## 최종 검사

- 전체 Vitest: 1693개 파일, 16094 통과, 의도된 실패 2, skip 4. 추가 janitor/agent-runtime/stats/legacy MCP/engineering 검사까지 `pnpm test` 완료 확인.
- 웹: 24개 파일, 139개 테스트 통과. Electron·웹·renderer 타입, 테스트 타입, lint 검사 통과.
- `check:design-lab`를 제외한 95개 계약 검사의 모든 blocking 검사 통과. concept-owner advisory는 기존 42건 유지; 이번 경계는 등록. RCA 문표 경고는 계약 로그에 보존.
- desktop·web 빌드 통과. 최종 수정 bundle에서도 원본 MP4 ended=true/error=null을 다시 확인.
- 필수 PR CI와 exact merge SHA 영수증은 병합 단계에서 확인.

## 검증 범위와 제한

고정된 QA 모델·입력으로 실제 GPU 경로를 검증. 모든 모델이나 이미지 품질을 보장하지 않음. 최신 로컬 전체 시각 검사는 기존 main과 같은 152건의 스냅샷 차이로 통과하지 못함. 기준 이미지를 갱신하거나 허용 오차를 높이지 않음. 필수 CI와 병합 SHA 검증은 별도로 기록.

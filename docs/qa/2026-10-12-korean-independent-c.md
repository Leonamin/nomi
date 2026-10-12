# 한국어 연결 코드 독립 검토 C

- 검토선: `/root/korean_c`
- 구현선: `/root`
- 날짜: 2026-10-12
- 워크트리: `/Users/leonamin/dev/nomi-web-korean-guidance`
- 범위: 한국어 리소스 연결, 언어 저장과 정규화, 데스크톱 IPC, 설정 이관, 모델 표시, AI 응답 언어, 도움말, 생성 복구와 알림, MCP 표시 계약, 텔레메트리 언어 메타데이터.

검토선 C가 작성한 번역 JSON과 MCP 번역 사전은 독립 검토 대상에서 제외했다. 이 보고서는 root 구현선의 연결 코드를 읽고 호출자를 추적한 결과다. 생성·결제·실제 외부 API 호출은 실행하지 않았다.

## 발견과 반영 확인

1. MCP의 `locale === 'en' ? en : zh` 경로가 한국어를 중국어로 처리했다. `mcpToolResults`, `mcpToolErrorResults`, `mcpCredentialElicitation`, `mcpTrustDowngrade`, `mcpTimelineConfirmation`에서 같은 원인을 확인했다. 현재는 `mcpLocaleText`로 모인다. 한국어 고정 문구는 사전을 사용하고, 사전에 없는 외부·동적 문구는 제공된 영어를 유지한다. 영어와 중국어 선택은 기존 문자열을 반환한다.
2. `translateModelDisplayText`의 한국어 분기가 사전 조회 직후 반환하여 동적 ComfyUI 상태를 중국어로 표시했다. 실제 표시 호출자는 `ComfyuiLocalCard`이며 생산자는 `comfyuiProbe`다. 현재 한국어 분기는 VRAM, 연결 성공, 연결 실패 안내를 처리한다. 기존 영어 분기는 유지됐다.
3. 웹 도움말이 장면 교체를 타임라인에서 찾도록 안내했다. 실제 버튼은 `NodeResultStack`의 생성 카드 결과 목록에 있다. 현재 도움말은 이 위치를 안내한다.

추가로 root의 최종 검증에서 드러난 공유 경계 변경을 확인했다. `electron/shared/contracts/locale.ts`가 지원 목록·타입·정규화를 소유하고 `src/i18n/index.ts`가 이 순수 계약을 가져온다. `desktopLocale.ts`는 호스트 상태를 관리하고 기존 API를 다시 내보낸다. 렌더러가 호스트 상태 모듈을 직접 가져오던 경로를 제거했다. MCP 제목 메타데이터는 `Partial<Record<ResultLocale, string>>`을 사용하고 테스트 주입은 `DesktopLocale`을 받는다.

## 계약과 행동 보존

`resources.ts`는 한국어 선택 이름과 리소스만 추가했다. 기존 영어·중국어 문구를 바꾸지 않았다. 한국어 선택은 저장된 언어 인식, 문서 `lang`, 호스트 IPC 동기화로 이어진다. `portableConfig`는 한국어 설정을 허용한다. `agentContext`와 장면 검증 프롬프트는 한국어 응답을 명시한다.

생성 복구는 한국어로 안내하면서 기존 재요청 허용 여부와 다음 행동을 유지한다. 제작 알림은 한국어 제목·본문을 선택하며 이벤트 우선순위, 중복 방지, 소리 및 이동 대상을 유지한다. `telemetryIpc`의 `nomi:telemetry:track`는 `ko`를 중국어로 바꾸지 않으며 기존 발신자·입력값 검사를 유지한다. 이벤트와 outbox 언어 타입에도 한국어가 포함된다.

## 근본 원인 계약 검증

`docs/fixes/2026-10-12-korean-locale-contract.root-cause.json`에 공유 계약 소유권과 productionNotifications·telemetryIpc 범위를 반영했다. 도어 목록은 `scripts/door-map.mjs`의 `doorsForTargets`로 생성했으며 162개다. 기존 투영 래퍼의 다음 호출 단계는 `L` 심벌로 추가 추적했다. `invariant_owner_layer`, `detected_by=review`, `recurrence_check_on=2026-11-11`을 기록했다.

실행: `node scripts/check-root-cause-contracts.mjs`

결과: 종료 코드 0. 경고 없음. 변경된 고위험 생산 파일 2개 모두 계약과 변경된 회귀 테스트가 있다는 검사 결과를 받았다.

## 판단과 검증 공백

확인한 root 연결 코드에서 추가 수정이 필요한 문제를 찾지 못했다. 위 세 발견은 소스로 반영을 확인했다. 이 보고서 자체는 앱 전체 번역 품질, 브라우저 화면, 실제 영상 생성, 알림 전달, 텔레메트리 업로드 성공을 보증하지 않는다. 해당 실행 증거는 통합 검증 보고서에서 확인해야 한다. 회귀 테스트 파일 존재와 변경 여부는 계약 검사로 확인했지만, 이 검토선이 별도로 테스트 묶음을 실행하지는 않았다.

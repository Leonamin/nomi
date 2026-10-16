---
type: Guide
title: "창작자 제작 흐름"
description: "프로젝트에서 장면 후보를 만들고 편집·미리보기·내보내는 흐름과 검증 한계"
scope: "wiki/guides"
okf_version: "0.1"
---

# 창작자 제작 흐름

제작의 개념 흐름은 프로젝트 → 장면 카드/문서 계획 → 명시적 승인 → 서버 생성 → 후보 편집 → 타임라인 → 미리보기·내보내기다. 아래 절차는 코드와 기존 안내를 정리한 것으로, 전체 흐름을 이번 위키 작업에서 새로 실사용 검증한 것은 아니다. 모델과 provider의 입력 요구사항은 다르므로 화면의 capability를 확인한다.

## 제작 순서

1. 새 프로젝트를 만들고 장면에 필요한 원고와 설명을 작성한다.
2. 이미지·영상 카드를 직접 쓰거나 지원되는 agent 도구에 계획 초안을 요청한다. 최근 실제 검증에서는 웹 agent가 `read_script`, `write_script`, `draft_shots`를 실행해 원고·장면 계획을 저장했다.
3. 생성은 승인 카드에서 내용을 확인하고 사용자가 승인한 뒤 제출한다. 승인 없이 닫은 검증 사례에서는 새 GPU job이 제출되지 않았고, 자동 재제출도 없었다.
4. 결과가 도착하면 후보를 확인한다. 후보 선택은 현재 후보를 바꾸는 동작이다. 이미 타임라인에 놓인 컷을 교체하려면 별도의 `Replace shot` 동작을 쓴다. 새 영상이 해당 구간보다 짧으면 교체가 거절될 수 있다.
5. 순서와 길이를 타임라인에서 조정하고 전체 미리보기를 확인한다. 웹 서버의 export가 완료되면 프로젝트 exports 결과를 다운로드한다.

생성·export는 서버에서 이뤄질 수 있으므로 브라우저 탭을 닫는 것과 서버 작업의 취소는 같은 의미가 아니다. 다만 서비스 재시작 중 진행하던 FFmpeg export는 안전 재개를 보장하지 않는다. 확인 후 새 export를 시작한다. 완료된 출력의 보존 여부는 해당 호스트 데이터와 작업 기록으로 확인한다.

## 지원 범위와 오래된 안내

초기 `docs/personal-web.md`에는 TTS, agent 자동 제작·검수·재생성은 제공하지 않는다고 쓰여 있다. 2026-10-15 코드에는 웹 OpenCode/Codex agent 도구 실행, 승인된 생성 카드 제출 경로가 있고, 데스크톱 catalog에는 TTS 모델 선언도 있다. 따라서 그 문구를 현재 전체 Nomi의 기능 제한으로 그대로 읽으면 부정확하다.

반대로, desktop TTS 선언만으로 개인용 웹의 TTS가 지원된다고 할 수도 없다. 이번 확인에서는 웹 RPC/provider 경로에서 `text_to_audio`를 생성하는 실제 사용자 흐름을 검증하지 않았다. **웹 TTS, 자동 검수·재생성, 결제 자동화, 다중 사용자 서비스는 이 가이드에서 지원됨으로 주장하지 않는다.** QA가 증명하는 것은 그 문서에 적힌 실제 agent tool execution 및 별도 승인 생성 사례뿐이다.

최근 웹 검증은 OpenCode/Codex tool execution, 승인된 이미지·영상 생성, 결과 복구, 브라우저 영상 재생을 각각 확인했다. 그것은 모든 모델·모든 창작 입력·완전한 자동 제작·장기 작업을 증명하지 않는다. 타임라인 전체 MP4 export와 standalone audio, 모든 플랫폼은 2026-10-15 browser acceptance 범위에서 미검증이었다.

## 근거와 확인일

- 확인일: 2026-10-16
- 기존 사용자 안내: [`docs/user-guide.ko.md`](../../docs/user-guide.ko.md), [`docs/personal-web.md`](../../docs/personal-web.md)
- 실제 제작·agent 증거: [`docs/qa/2026-10-14-recovered-web-production.md`](../../docs/qa/2026-10-14-recovered-web-production.md), [`docs/qa/2026-10-15-web-agent-tool-execution.md`](../../docs/qa/2026-10-15-web-agent-tool-execution.md)
- 브라우저 미디어 검증과 한계: [`docs/qa/2026-10-15-web-platform-media-browser.md`](../../docs/qa/2026-10-15-web-platform-media-browser.md)
- 웹 실행 구현: [`web/agentProcess.ts`](../../web/agentProcess.ts), [`web/agentTools.ts`](../../web/agentTools.ts), [`web/rpc.ts`](../../web/rpc.ts)

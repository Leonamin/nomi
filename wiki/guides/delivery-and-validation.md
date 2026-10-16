---
type: Guide
title: "변경 전달과 검증"
description: "로컬 검사부터 PR, merge receipt, 운영 배포 증거까지 상태를 구분하는 안내"
scope: "wiki/guides"
okf_version: "0.1"
---

# 변경 전달과 검증

Nomi 변경은 로컬 결과, hosted CI, merge receipt, live 배포, 실제 제품 작업 증거를 각각 확인한다. 앞 단계의 성공을 다음 단계의 성공으로 추정하지 않는다.

## 로컬 검사와 PR

작업 전 독립 worktree와 기준 상태를 확인하고 `pnpm run delivery:preflight`를 실행한다. 수정 파일과 위험 범위에 따라 `pnpm run gates` 또는 `pnpm run gates:full`, 웹 변경이면 웹 타입 검사·`test:web`·`build:web` 등 실제 영향 경로를 확인한다. 실패와 환경상 확인하지 못한 항목은 그대로 보고한다.

완료한 변경은 PR로 전달한다. main에 직접 push하지 않는다. push 전 최신 `origin/main`과 작업 브랜치를 통합하고, task commit·PR head·merge commit은 각각 보고한다. 병합 판단과 병합은 coordinator 소유다.

## 병합 후와 배포

정상 경로는 실제 fetch한 merge SHA에서 `pnpm run delivery:verify-merged -- --expected-sha <SHA>`를 사용한다. 필수 CI check가 생략되거나 없으면 성공 receipt로 취급하지 않는다. 로컬 빌드나 비슷한 tree는 remote check의 대체 증거가 아니다.

실제 운영 배포는 별도 단계다. 웹 호스트의 현재 build SHA와 health를 확인하고, 사용자에게 보이는 변경은 실제 브라우저와 필요한 생성·내보내기 흐름에서 검증한다. GPU가 없는 CI의 green은 실제 생성 성공을 증명하지 않는다. 별도 사용자 승인 예외가 있었다면 해당 PR·범위와 로컬 receipt를 연결하고 remote CI 결과를 성공으로 바꾸어 표현하지 않는다.

저장소가 사용하는 네 가지 상태 표현은 다음과 같다.

- `已实现未推送`: 구현됐지만 push되지 않음
- `已推送待合入`: push됐으며 merge 대기
- `已合入待验证`: merge됐지만 merge-SHA 검증 대기
- `已解决`: merge SHA 검증까지 완료

## 근거와 확인일

- 확인일: 2026-10-16
- 정책 원문: [`docs/engineering/delivery-and-review.md`](../../docs/engineering/delivery-and-review.md)
- 명령: [`docs/engineering/commands.md`](../../docs/engineering/commands.md)
- QA 예시는 [웹 복구 검증](../../docs/qa/2026-10-14-recovered-web-production.md) 및 [브라우저 미디어 검증](../../docs/qa/2026-10-15-web-platform-media-browser.md)을 참조한다. 두 보고서의 각 검증 범위와 한계는 서로 다르며, 현재 운영 상태를 대신하지 않는다.

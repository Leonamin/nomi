---
type: Reference
title: "역사 기록과 검증 증거 찾기"
description: "계획·감사·검증 증거를 원본 경로와 상태를 지켜 탐색하는 안내"
scope: "references/history"
okf_version: "0.1"
---

# 역사 기록과 검증 증거 찾기

문서의 날짜나 계획형 제목은 현재 할 일이라는 뜻이 아니다. 먼저 자료의 상태·기준 커밋·완료 기록을 확인하고, 현재 상태는 코드와 가장 최근의 재현 가능한 증거로 다시 판단한다.

## 찾아가기

- [`docs/plan/INDEX.md`](../../docs/archive/plan/INDEX.md)는 계획의 주제와 표기된 상태를 안내한다. 인덱스 자체가 역사적 누락을 알리므로, 못 찾으면 저장소 전체에서 검색한다.
- [`docs/superpowers/plans/INDEX.md`](../../docs/archive/superpowers/plans/INDEX.md)는 교차 단계 계획을 찾는 진입점이다.
- [`docs/archive/`](../../docs/archive)는 보존용 기록이다. 예를 들어 [2026년 5월 shipped 자료](../../docs/archive/2026-05-shipped/README.md)는 해당 계획이 당시 출시된 버전과 연결되었다고 설명하지만, 오늘의 동작을 증명하지 않는다.
- [`docs/audit/`](../../docs/archive/audit), [`docs/fixes/`](../../docs/fixes), [`docs/evidence/`](../../docs/evidence)는 진단·수정·검증 패키지를 찾는 경로다. 실험별 README/보고서에서 원본 산출물로 이동한다.
- [`docs/lessons/INDEX.md`](../../docs/lessons/INDEX.md)는 재발 방지 교훈의 색인이다. 현재 작업 규칙은 그 교훈의 원문과 프로젝트 지침을 함께 확인한다.

## 증거와 기계 참조 보존

README, 보고서, 인덱스는 자료 안내자다. JSON 계약, run 기록, 스키마, 테스트 픽스처, 스크린샷, 영상 및 기타 원본 증거는 생성·검증 도구가 참조하는 경로에 그대로 둔다. 위키에 복사하거나 이동해 두 번째 사본을 만들지 않는다. 원본 경로를 링크하고, 도구 계약이 무엇을 읽는지 확인한다.

저장소 문서에서 언급하는 검색·검증 도구 예시는 `pnpm run check:docs-index`, `pnpm run check:agents-sync`, `pnpm run ledger:brief`다. 명령의 현재 등록 여부는 `package.json`과 함께 확인한다. 특히 조사·ledger 명령은 이번 위키 이관에서 실행해 외부 자료나 현재 TODO를 재검증한 것이 아니다. 과거 조사 템플릿의 `check:research-sources`는 현재 `package.json`에 없는 명령이므로 실행 예시로 사용하지 않는다. 실행 전에 [`package.json`](../../package.json), 명령 정의와 해당 도구가 읽거나 쓰는 경로를 확인한다. ledger의 로컬 뷰처럼 git에 포함되지 않는 산출물은 저장소의 확정 기록으로 취급하지 않는다.

상태를 적을 때 `historical`은 당시의 기록, `reference`는 탐색용 자료, `needs-verification`은 현재성 또는 도구 참조 미확인을 뜻한다. 실제 현재 동작 확인에는 확인일, 코드/명령, 결과를 함께 기록한다.

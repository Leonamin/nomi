---
type: Reference
title: "외부 조사 자료 큐레이션"
description: "외부 출처를 추적하고 조사 결과를 현행 사실과 구분하는 방법"
scope: "references/research"
okf_version: "0.1"
---

# 외부 조사 자료 큐레이션

기존 조사는 원문 위치로 연결한다. 인용이나 요약을 옮길 때 원자료의 URL·저자/기관·게시일, 조사 문서 경로, 확인 날짜와 조사 시점의 저장소 기준을 함께 보존한다. URL이 현재도 유효하거나 내용이 최신이라는 뜻으로 표현하지 않는다.

## 탐색 경로

- 조사 작성 규칙과 템플릿: [`docs/archive/research/TEMPLATE.md`](../../docs/archive/research/TEMPLATE.md)
- 주제별 조사·첨부 파일: [`docs/archive/research/`](../../docs/archive/research)
- 경쟁 제품 조사 진입점: [`docs/archive/research/competitive/README.md`](../../docs/archive/research/competitive/README.md)
- 예시 연구 묶음: [`docs/archive/research/2026-09-05-nomi-unified-agent-canvas-skill-solution/README.md`](../../docs/archive/research/2026-09-05-nomi-unified-agent-canvas-skill-solution/README.md)

`docs/README.md`와 각 하위 README를 먼저 보고, 누락 가능성이 표시된 인덱스에서 찾지 못하면 원본 폴더를 검색한다. 검색된 보고서가 말하는 구현 여부는 [현재 fork 개념](../concepts/index.md)과 연결된 코드·QA에서 별도로 확인한다. [이전 아키텍처 장부](../../docs/archive/guides/ARCHITECTURE-NOW.md)는 2026-09-26 기준의 상속 기록이다.

## 상태 구분

- `reference`: 출처나 방법을 찾아볼 수 있으나 현재 동작의 증거는 아님.
- `historical`: 특정 날짜·기준의 조사나 제안. 오래된 계획을 현재 TODO나 승인 결정으로 승격하지 않는다.
- `needs-verification`: 출처, 현재 유효성, 구현 반영 여부 중 하나 이상을 확인하지 못함.
- `verified-as-of`: 실제 확인 날짜와 근거를 기록한 제한적 확인. 이후에도 유효하다는 보증은 아니다.

새 조사에는 질문, 1차 출처 URL 및 게시일, 관찰 날짜, 저장소 기준점, 실행 여부와 미확인 영역을 남긴다. 조사 템플릿의 출처 표와 정직한 검증 기록을 우선한다. 기존 조사의 조사일이나 원출처 날짜가 없으면 추정하지 말고 `needs-verification`으로 표시한다.

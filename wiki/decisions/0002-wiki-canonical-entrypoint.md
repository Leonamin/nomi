---
type: Decision
title: "ADR 0002: 위키를 현재 지식의 탐색 정본으로 둔다"
description: "현재 fork 지식은 wiki 진입점에서 분류별 정본으로 탐색한다"
scope: "decisions/0002-wiki-canonical-entrypoint"
okf_version: "0.1"
status: "accepted"
---

# ADR 0002: 위키를 현재 지식의 탐색 정본으로 둔다

- 상태: 채택
- 결정일: 2026-10-16

## 맥락

사용자는 기존 프로젝트 기록과 검증 증거를 보존하면서 현재 fork의 한국어 지식을 `wiki/` 구조에 정리하도록 승인했다. 저장소의 코드·기계 계약·QA 원본은 기존 위치에서 유지해야 하며, 계획이나 과거 보고서를 현재 구현 사실처럼 보이면 안 된다.

## 결정

`wiki/index.md`를 현재 fork 지식의 읽기 시작점으로 삼고 각 위키 분류의 `index.md`가 바로 아래 정본 문서를 안내한다. `concepts/`는 코드와 현재 문서에서 확인한 동작 개념, `decisions/`는 근거가 있는 승인 결정, `guides/`는 작업 절차, `references/`는 원본 자료 경로를 제공한다. 코드와 QA, 계획 문서는 원래 경로가 계속 원본이며 위키는 연결·요약한다.

## 결과

지식 찾기는 한국어 위키에서 시작할 수 있다. 내용이 바뀔 수 있는 구현 사실에는 확인일과 근거 링크를 남긴다. 승인 근거가 없는 정책은 ADR로 새로 만들지 않는다. 과거 문서나 증거는 자동 이동·삭제하지 않는다.

## 근거

- 사용자 승인 범위, 정본 위치, 보존 원칙과 형식: [2026-10-16 Korean fork wiki plan](../../docs/archive/plan/2026-10-16-korean-fork-wiki.md)
- 현 디렉터리 색인: [wiki/index.md](../index.md), [concepts/index.md](../concepts/index.md), [decisions/index.md](index.md)
- 확인일: 2026-10-16

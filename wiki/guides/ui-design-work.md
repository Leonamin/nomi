---
type: Guide
title: "UI 디자인 작업"
description: "기존 UI 조사부터 디자인 기준 재사용, 샘플과 브라우저 검증까지의 작업 흐름"
scope: "wiki/guides"
okf_version: "0.1"
---

# UI 디자인 작업

화면을 바꾸기 전 현재 화면과 소유 컴포넌트를 확인하고, 기존 token·component·pattern을 재사용한다. 디자인 변경은 화면 크기와 언어 등 실제 사용 조건에서 확인하며, 코드가 빌드된 사실만으로 시각 검증을 완료 처리하지 않는다.

## 조사와 구현

1. [Nomi 디자인 시스템](../../docs/design/nomi-design-system.md)에서 원칙, token, 컴포넌트 위치와 해당 pattern을 찾는다. 문서의 상단은 2026-09-07 재검토와 v0.21.0 코드 범위를 적고 있으므로, 이 fork의 실제 호출부와 token 정의도 함께 확인한다.
2. 기존 UI를 바꾸는 경우 실제 화면과 현재 컴포넌트 구현을 먼저 읽는다. 새 상시 버튼이나 두 번째 진입 경로를 만들기 전에 기존 동작이 이미 어디 있는지 확인한다.
3. 공용 버튼·form·modal은 `src/design/`, canvas node는 `src/workbench/generationCanvas/nodes/`, canvas overlay는 `components/`, agent composer는 `src/workbench/ai/composer/`의 기존 소유 위치를 살펴본다. UI 문구는 기존 i18n 흐름을 따른다.
4. 새 시각 요소가 기존 자산에 없을 때에만 디자인 시스템의 추가 절차를 참조한다. 색·글자·모서리·간격은 token 사용을 우선하고, 아이콘은 등록된 Tabler 사용 흐름을 따른다.

## 샘플과 검증

UI 변경을 구현하기 전에 사용자가 경험할 수 있는 샘플을 제시하고 sign-off를 받는 절차가 프로젝트 지침에 있다. 샘플을 실제 화면 변경으로 오인하지 않는다. 승인 뒤 구현하고 언어별·화면 크기별 실제 화면을 확인한다. 프로젝트의 user-visible delivery 지침이 요구하는 캡처 확인을 생략하지 않는다.

정적 디자인 문서 자체는 최신 상태를 보증하지 않는다. 예를 들어 디자인 시스템이 덮는 코드 버전과 fork의 현재 main이 다를 수 있으므로, 문서는 탐색용 기준으로 쓰고 충돌은 소스 코드와 최신 승인 샘플로 판정한다.

## 근거와 확인일

- 확인일: 2026-10-16
- 디자인 기준: [`docs/design/nomi-design-system.md`](../../docs/design/nomi-design-system.md)
- 프로젝트 절차: [`AGENTS.md`](../../AGENTS.md)
- token·국제화 검사 정의: [`package.json`](../../package.json)

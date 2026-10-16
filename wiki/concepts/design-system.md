---
type: Concept
title: "Nomi 디자인 체계"
description: "Nomi의 제작 화면 원칙과 UI token/component 기준"
scope: "concepts/design-system"
okf_version: "0.1"
---

# Nomi 디자인 체계

Nomi UI는 스크립트·생성·편집·미리보기·내보내기 제작 흐름을 돕는 밀도 높은 작업면이다. 장식보다 정보 밀도와 한눈에 보이는 위계를 우선하고, 진행 상황을 꾸며내지 않으며, 최종 제작 결정은 사용자가 명시적으로 제어한다.

컴포넌트는 `src/design/`의 공유 디자인 모듈을 따른다. 디자인 문서는 시각 값의 기준 위치와 사용 가능한 공용 컴포넌트를 안내하지만, 문서 자체에 오래된 표현이 남아 있을 수 있다. 특히 저장소의 루트 `Design.md`는 light-only를 적고 있지만, 상세 디자인 문서에는 2026-06-24에 다시 추가된 light/dark token 동작이 기록되어 있다. 현재 값을 확인할 때는 `tailwind.config.ts`, `src/theme/nomiTheme.ts`, 실제 디자인 모듈과 최근 QA를 우선 대조한다.

## 근거와 확인일

- 현재 디자인 체계 설명: [docs/design/nomi-design-system.md](../../docs/design/nomi-design-system.md)
- 간략 원칙 문서: [Design.md](../../Design.md)
- 공유 컴포넌트: [src/design/index.ts](../../src/design/index.ts), [src/design/tokens.ts](../../src/design/tokens.ts)
- theme/token 소스: [src/theme/nomiTheme.ts](../../src/theme/nomiTheme.ts), [tailwind.config.ts](../../tailwind.config.ts)
- 확인일: 2026-10-16. 문서 간 색상 모드 설명이 다르므로 새 UI 작업 전 실제 구현을 재확인한다.

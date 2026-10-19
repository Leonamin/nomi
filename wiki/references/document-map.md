---
type: Reference
title: "문서 이관 지도"
description: "현재 안내의 위키 정본과 기존 문서·기계 계약·증거의 보존 위치"
scope: "references/document-map"
okf_version: "0.1"
---

# 문서 이관 지도

확인 기준은 2026-10-16, 작업 base `314ef86d008133bb385d63eb05bb24e75583a3b6`다. 기존 `docs/`의 추적 파일은 5,432개, Markdown은 2,030개이며, 다음 분류는 문서 전체를 읽고 모든 주장을 재인증했다는 뜻이 아니다. 현재 지식은 핵심 안내·코드·최근 QA를 대조해 추출했다. 역사 원문은 당시 결정과 증거를 보존한다.

## 현재 지식의 이관

| 기존 문서·근거 | 현재 위키의 소유 문서 |
| --- | --- |
| [fork 경계](../../docs/archive/guides/fork-boundary.md), [초기 웹 계획](../../docs/archive/plan/2026-10-12-personal-web.md), `web/` | [fork 범위](../concepts/fork-scope.md), [ADR 0001](../decisions/0001-web-first-fork.md) |
| [개인용 웹 안내](../../docs/archive/guides/personal-web.md), `web/{server,rpc,hostCapabilities}.ts` | [웹 호스트](../concepts/web-host.md), [개발](../guides/local-development.md), [배포](../guides/web-host-release.md) |
| [한국어 사용 안내](../../docs/archive/guides/user-guide.ko.md), 10월 QA, 실제 생성·타임라인 코드 | [제작 흐름](../guides/creator-workflow.md), [생성·음성 경계](../concepts/media-generation.md) |
| [상세 디자인 시스템](../../docs/design/nomi-design-system.md), `src/design/` | [디자인 체계](../concepts/design-system.md), [디자인 작업](../guides/ui-design-work.md). 토큰·규범 원본은 기존 경로 유지 |
| [명령 표](../../docs/engineering/commands.md), [전달 규칙](../../docs/engineering/delivery-and-review.md), `package.json` | [개발](../guides/local-development.md), [전달과 검증](../guides/delivery-and-validation.md). 명령·규칙 원본은 기존 경로 유지 |
| [이전 총목차](../../docs/archive/2026-10-16-document-map/INDEX.md), 조사·계획·감사 색인 | [역사와 증거](history-and-evidence.md), [외부 조사](external-research.md) |

## 현재 분류 (2026-10-19)

- `docs/engineering/`, `fixes/*.root-cause.json`, `GLOSSARY.md`, 코딩·패키지 규범: 현재 기계 계약과 규범.
- `docs/design/nomi-design-system.md`, `nomi-design-flow-howto.md`: 현재 디자인 규범.
- `docs/plan/`: 현재 fork에서 진행 중인 작업과 색인.
- `docs/guide/`, SEO·릴리스·통계·인증 등 자동화 자료: 실제 소비되는 입력·출력·정책.
- `docs/archive/`: 과거 증거·QA·시안·계획·교훈·조사·원인 분석 첨부. 실행 스크립트도 함께 이동하고 소비자의 파일 참조와 상대 import를 수정했다.

[현재 이동표](../../docs/archive/2026-10-19-path-map.json)는 1차 이동표를 이어 받는다. 이전 주소 안내 156개 중 현행 작업 색인으로 교체한 1개를 제외한 155개를 삭제했으며, 현재 작업 색인에도 과거 링크 목록을 남기지 않는다. 구형 v1/v2 원인 계약은 바이트를 유지하고 v3의 문서·증거 참조를 보관 위치로 갱신했다. 원본 로그·실험 JSON·이미지·영상·HTML은 바이트를 보존한다.

## 이후 갱신

- 현재 fork 설명을 바꾸면 해당 위키 문서와 부모 색인을 갱신한다. 일반 안내 원문은 역사 출처로 남기며 병행 갱신하지 않는다.
- 기계 계약·규칙·디자인 원본을 바꾸면 그 소유 경로에서 변경하고 위키의 요약·링크를 맞춘다.
- 새로운 현재 기능은 구현·검증·배포를 구분해서 기록한다. 미확인 문서를 날짜만 보고 삭제하거나 현행으로 승격하지 않는다.

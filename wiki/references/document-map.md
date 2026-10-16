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
| [이전 총목차](../../docs/README.md), 조사·계획·감사 색인 | [역사와 증거](history-and-evidence.md), [외부 조사](external-research.md) |

## 보존 경로와 용도

2026-10-16 후속 정리에서 과거 파일 2,565개를 `docs/archive/` 아래로 실제 이동했다. 현재 경로는 [보관 색인](../../docs/archive/index.md)과 [이동표](../../docs/archive/2026-10-16-path-map.json)에서 확인한다. 비문서 산출물 1,056개는 내용 해시를 유지했다. 기계 계약과 기존 코드의 고정된 문서 주소는 짧은 원문 안내로 남긴다.

폴더 이름만으로 문서의 유효성을 판정하지 않는다. 미래 문서도 기계 입력은 소유 경로에 유지하고, 위키의 current fact와 연결한다.

| 보존 경로 (`docs/` 기준) | 용도와 읽기 원칙 |
| --- | --- |
| `engineering/`, `engineering-rules.md`, `GLOSSARY.md`, `coding-standards.md` | 현재 검사·명령·규칙의 원본. JSON·스키마·규범을 위키에 복제하지 않음 |
| `fixes/` | 원인 계약과 관련 증거. schema·문서 버전·경로를 유지 |
| `plan/`, `superpowers/` | 작업 설계 카드·기존 계획·하위 첨부. 상속 계획의 상태는 현재 fork TODO가 아님 |
| `evidence/`, `qa/`, `audit/`, `onboarding-trials/`, `evals/` | 검증·감사·실험의 조건과 실패 이력. mock/local/hosted/live 범위를 원문대로 읽음 |
| `design/` | 상세 디자인 규범, 원본 시안과 승인·비교 자료. `archive/`는 과거 시안 |
| `research/`, `product/`, `marketing/`, `seo/` | 조사 당시 외부 사실과 제안. 현재 채택·지원 여부는 위키와 코드로 확인 |
| `architecture/`, `architecture-review/`, `handoff/`, `workflow/`, `lessons/` | 상속 구조·결정·방법·교훈. 확인 시점과 코드 근거를 대조, 교훈 원본·색인 유지 |
| `guide/`, `integrations/`, `integration-certification/`, `testing/`, `test/` | 기능별 기존 설명과 인증·테스트 자료. 개인용 웹 지원 여부는 현재 위키에서 먼저 확인 |
| `release-notes/`, `release/`, `roadmap/`, `archive/` | 릴리스·계획 포인터·역사 기록. 과거 릴리스와 현재 배포를 구분 |
| `media/`, `feedback/`, `security/`, `stats/` | 첨부·설정 예시·정책·통계 도구 안내. 공개 예시와 실제 운영 비밀 값을 구분 |

`plan/`에는 1,648개 파일(Markdown 866개), `fixes/` 1,123개, `evidence/` 637개가 있었다. 이 폴더를 통째로 이동하면 계약 안의 경로·검증 도구·과거 증거의 상대 링크가 함께 바뀐다. 위키 전환 후의 물리적 보관에서는 역사 묶음을 archive로 이동하고 관련 도구·테스트의 경로를 맞췄다. 원인 계약·규범·현재 자동화 입력과 실행 문맥이 필요한 코드/HTML 증거 패키지는 원래 경로에 유지한다. 원본 로그·이미지·영상·실험 JSON의 내용과 당시 결정을 다시 쓰지 않는다.

## 이후 갱신

- 현재 fork 설명을 바꾸면 해당 위키 문서와 부모 색인을 갱신한다. 일반 안내 원문은 역사 출처로 남기며 병행 갱신하지 않는다.
- 기계 계약·규칙·디자인 원본을 바꾸면 그 소유 경로에서 변경하고 위키의 요약·링크를 맞춘다.
- 새로운 현재 기능은 구현·검증·배포를 구분해서 기록한다. 미확인 문서를 날짜만 보고 삭제하거나 현행으로 승격하지 않는다.

---
type: Reference
title: "Upstream 출처와 공유 경계"
description: "fork의 출처와 upstream 자료·현재 정본·기계 계약 사이의 경계"
scope: "references/upstream"
okf_version: "0.1"
---

# Upstream 출처와 공유 경계

2026-10-16 `git remote -v` 확인 결과 현재 fork의 `origin`은 [Leonamin/nomi](https://github.com/Leonamin/nomi), `upstream`은 [aqm857886159/Nomi](https://github.com/aqm857886159/Nomi)다. fork의 초기 검증 기준은 upstream v0.23.1의 `66d6eafed07ad6239acd765dd05c9eb0870cf849`이며, 최신 upstream과 동기화됐다는 뜻은 아니다. 저장소의 [AGPL 라이선스](../../LICENSE)를 유지한다.

## 무엇을 어디서 읽나

- [저장소 문서 지도](../../docs/README.md)는 기존 문서의 주제별 진입점이다. TODO, 사용자 발화, 원시 조사 자료 일부는 유지자 전용 위치로 옮겨졌다고 명시하므로 저장소 안에 있다고 가정하지 않는다.
- [이전 아키텍처 장부](../../docs/ARCHITECTURE-NOW.md)는 2026-09-26 기준의 상속 기록이다. 현재 웹 구조는 [웹 호스트 개념](../concepts/web-host.md)에서 시작한다. [용어집](../../docs/GLOSSARY.md)은 검사 도구가 읽는 규범 어휘의 원본이므로 경로를 유지한다.
- 위키의 [개념](../concepts/index.md)과 [가이드](../guides/index.md)는 검증된 현재 fork 사용 지식의 정본이다. 기존 docs 자료를 그대로 복사해 두 정본을 만들지 않는다.
- `docs/engineering/`, `docs/fixes/`의 JSON·스키마·규칙 계약과 생성 파일은 도구가 읽는 원본이다. 수정이나 재배치 전에 소유 도구를 확인하고 경로와 형식을 보존한다.

## 기록할 출처

포크 유래를 설명할 때는 가능한 한 upstream URL 또는 remote 이름, 원본 경로, 가져온 기준 커밋/날짜, 로컬 변경 여부를 적는다. Git에서 확인하지 못한 관계는 `needs-verification`으로 둔다. 개인 홈 디렉터리 절대경로를 위키에 넣지 않는다.

확인 기준: 위키 작업의 base `314ef86d008133bb385d63eb05bb24e75583a3b6`와 그 시점의 Git remote 설정. 운영 배포 SHA와 upstream 동기화 여부의 검증은 이 문서 이관의 범위 밖이다.

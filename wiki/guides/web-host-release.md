---
type: Guide
title: "웹 호스트 배포 흐름"
description: "웹 호스트에 정확한 Git 커밋을 별도 release로 설치하고 전환하는 절차"
scope: "wiki/guides"
okf_version: "0.1"
---

# 웹 호스트 배포 흐름

배포 도구는 Git에서 확인한 정확한 40자리 commit으로 clean release worktree를 만들고, 빌드한 다음 Nomi 소유 systemd user unit과 `current` 링크를 전환한다. 이 절차 설명은 특정 커밋이 현재 배포됐다는 증거가 아니다.

## 배포 전 준비

호스트 저장소의 환경 파일에는 release 경로, 전용 웹 데이터 경로, origin과 포트를 둔다. 해당 파일은 실제 장비에서만 관리하고 저장소나 위키에는 secret 및 개인 경로를 기록하지 않는다. 웹 데이터 루트는 데스크톱 데이터와 분리해야 한다.

배포 wrapper는 호스트 설정을 읽고 origin을 fetch한 뒤 `origin/main` 또는 지정 커밋을 SHA로 풀어 release worktree를 만든다.

```sh
scripts/web/deploy.sh --env /path/to/deploy.env
scripts/web/deploy.sh --env /path/to/deploy.env <40자리-commit-sha>
```

첫 번째 형태는 설정된 배포 브랜치(기본 `origin/main`)의 최신 fetch 결과를 고른다. 두 번째는 지정한 commit을 배포한다. 명령을 실행하기 전 대상 SHA와 현재 호스트 설정을 확인한다.

## 활성화와 보존 경계

`scripts/web/deploy-web-host.mjs <sha>`는 release와 현재 checkout의 dirty 상태를 거부하고 SHA 일치 및 포트 점유를 확인한다. frozen pnpm install, 웹 빌드, browser 준비 후 전용 runtime env와 Nomi 관리 unit을 갱신하고 `current`를 바꿔 서비스만 재시작한다. 전용 웹 데이터는 release 경로 밖에 유지된다.

`NOMI_WEB_KEEP_RELEASES`가 지정되면 활성화 후 오래된 release 산출물을 정리한다. 미지정이면 release를 보존한다. 현재 코드 주석은 정리 대상을 release worktree로 설명한다. 롤백은 보존된 clean release로 current를 돌리고 build SHA를 맞춰 웹 unit을 재시작하는 절차이며, 프로젝트 데이터를 지우는 작업이 아니다.

ComfyUI SSH 터널은 `NOMI_WEB_COMFYUI_SSH`가 설정된 경우에만 전용 unit으로 관리한다. 별도 공개 HTTPS 설정, 개인 tailnet 접근 제어, origin 허용 경계는 운영자가 구성한다. 이 웹 버전은 공개 인터넷 계정 체계를 제공한다는 증거가 없다.

## 배포 결과 확인

각 변경에 대해 다음 신원을 분리해서 확인한다: 작업 commit, PR head, merge commit, 실행 중인 호스트의 build SHA. 스크립트 출력이나 PR 상태만으로 live 상태를 단정하지 않는다. 배포 후 서비스 health, 실행 SHA, 실제 화면과 필요한 제작 작업을 해당 QA 증거에서 확인한다.

이 문서 확인일(2026-10-16)에는 이 세션에서 호스트에 접속해 현재 실행 SHA나 health를 새로 확인하지 않았다. 그러므로 현재 운영 배포 상태는 **미확인**이다.

## 근거와 확인일

- 확인일: 2026-10-16
- 코드: [`scripts/web/deploy.sh`](../../scripts/web/deploy.sh), [`scripts/web/deploy-web-host.mjs`](../../scripts/web/deploy-web-host.mjs)
- 운영 설정과 한계: [`docs/archive/guides/personal-web.md`](../../docs/archive/guides/personal-web.md)
- 실제 검증 사례와 범위: [`docs/archive/qa/2026-10-14-recovered-web-production.md`](../../docs/archive/qa/2026-10-14-recovered-web-production.md), [`docs/archive/qa/2026-10-15-web-platform-media-browser.md`](../../docs/archive/qa/2026-10-15-web-platform-media-browser.md)

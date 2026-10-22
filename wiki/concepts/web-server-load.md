---
type: Concept
title: "웹 서버 부하와 폴링 읽기"
description: "프로젝트에 실행 기록이 많을 때 서버가 포화되던 원인, 수정(PR #49), 남은 부하와 측정 방법"
scope: "concepts/web-server-load"
okf_version: "0.1"
---

# 웹 서버 부하와 폴링 읽기

2026-10-22 "마인크래프트 VLOG" 프로젝트에서 로딩이 매우 느리고 캔버스를 드래그하기 힘들 만큼 버벅였다. 원인은 브라우저가 아니라 서버였고 PR #49로 크게 줄었다.

## 원인

- 웹 서버는 Node 단일 스레드이고 파일 읽기와 JSON 해석이 동기 호출이다. 요청 하나가 오래 걸리면 뒤 요청이 모두 줄을 선다.
- 브라우저 탭마다 `production-runs:list`, `exports:list`, `production-runs:pending-spend`를 1.5초 간격으로, `generation-snapshot`·`creation-snapshot`을 2초 간격으로 부른다(비용 확인 카드가 있는지 화면이 계속 묻는 구조).
- `pending-spend`와 `list`는 Run마다 프로젝트 폴더를 다시 찾으면서(워크스페이스 매니페스트를 디스크에서 읽고 해석) 이벤트 파일을 읽었다. `pending-spend`는 `list`로 전부 읽은 뒤 같은 Run을 한 번 더 읽었다. 이 프로젝트는 Run 13개, 이벤트 파일 합계 17.6MB였다.
- 서버를 6초 프로파일링했을 때 CPU가 사실상 100%였고 `pending-spend` 64%, `list` 27%였다. 같은 시점 사용자의 브라우저 탭 폴링도 섞여 있었을 수 있다.
- 같은 코드가 데스크톱 앱에서는 IPC라 비용이 작았고, 웹 호스트의 HTTP 폴링에서 드러났다.

## 수정과 효과 (PR #49, 병합 `32d63e1fd`, 2026-10-22 배포)

- `productionRunRepository`에 `readAll`을 추가해 프로젝트 폴더를 한 번만 확인하고 Run당 한 번만 읽는다. `pending-spend`는 `list`+`read` 이중 읽기 대신 이를 쓴다. 디스크가 원본이라는 원칙은 그대로이고 캐시는 넣지 않았다.
- 같은 배포에서 측정한 값: 캔버스가 뜨기까지 4.3, 5.2, 4.4초(수정 전 2.9~28.7초로 들쭉날쭉), 서버에 직접 요청하면 약 0초(수정 전 24~60초), 탭 하나당 CPU 약 15%(수정 전 약 28%이고 포화 상태 위).
- 사용자가 실제 사용에서 드래그가 버벅이지 않는다고 확인했다.

## 남은 부하 (후보, 요청 전까지 시작하지 않음)

- 탭 하나가 여전히 CPU 약 15%와 읽기 30MB/s를 쓴다. 같은 폴링이 바뀌지 않은 Run도 매번 디스크에서 다시 읽는다(`readAll` 18%, 이벤트 파일 읽기 8%). 탭이 2개면 45~55%로 비선형이다(원인 미격리).
- 후보: 바뀌지 않은 Run은 다시 읽지 않기(mtime 비교), 폴링 주기 정리·합치기, 변경 알림 방식. 
- 프로젝트를 열 때 앱이 자동 저장(`projects:save-async`)을 한 번 호출한다. 열 때마다 파일을 다시 쓰는지 점검할 만하다.
- 프로젝트 파일이 856KB이고 `generation-snapshot` 응답이 590KB다(`webAgentSeenCanvas`가 캔버스를 중복해 담는 것이 32%). 2초마다 통째로 오간다.
- 영상 14개와 이미지 17개는 썸네일이 저장되지 않아 캔버스가 원본 이미지를 불러온다.

## 서버 프로파일링 방법

서버 프로세스에 `kill -USR1 <pid>`를 보내면 Node 인스펙터가 127.0.0.1:9229에 열린다(로컬 접속 전용, 재시작 시 닫힘). Node 24는 전역 `WebSocket`이 있어 짧은 스크립트로 `Profiler.start`/`stop`을 호출해 `.cpuprofile`을 얻을 수 있다. 게이트처럼 CPU를 쓰는 작업이 돌 때는 측정이 왜곡되므로 조용할 때 한다.

## 근거와 확인일 (2026-10-22)

- 코드: [productionRunRepository.ts](../../electron/productionRun/productionRunRepository.ts), [appIntegrationSpendConfirm.ts](../../electron/capabilityCore/appIntegrationSpendConfirm.ts), [web/rpc.ts](../../web/rpc.ts).
- 측정: 하위 에이전트의 브라우저·서버 측정과 서버 6초 프로파일(수정 전), 배포 후 재측정(탭 없음·1개·2개). 수정 전의 "탭 없음 75~100%"는 다른 탭이 섞였을 수 있어 같은 조건 비교는 탭당 비용과 로딩 시간만 가능하다.
- 확인하지 못한 것: 브라우저 쪽 드래그 병목(에이전트 환경에서는 60fps라 재현되지 않음), 탭 2개 비선형의 원인.

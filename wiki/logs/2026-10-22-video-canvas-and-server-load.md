---
type: Log
title: "캔버스 영상 생성과 웹 서버 부하 지식 반영"
description: "PR #47~#50의 병합·배포 결과와 VLOG 실사용에서 확인한 값·한계·남은 후보를 위키에 반영"
timestamp: 2026-10-22
okf_version: "0.1"
---

# 캔버스 영상 생성과 웹 서버 부하 지식 반영

2026-10-20~22에 병합·배포한 PR #47(영상 모델 선택창), #48(ComfyUI 진행률), #49(서버 읽기 낭비), #50(대사 말투 지침)과 "마인크래프트 VLOG" 실사용 결과를 위키에 정리했다. 새 세션이 영상 생성을 바로 시작할 수 있도록 절차·실측값·한계·남은 후보를 한 문서에 모았다. 남은 후보(프로젝트 정리, 서버 부하 추가 절감, H3 크기 16:9, 0.24 따라잡기)는 요청이 있을 때까지 시작하지 않는다.

## 추가한 문서

- [캔버스에서 로컬 ComfyUI로 영상 만들기](../concepts/canvas-video-generation.md)
- [웹 서버 부하와 폴링 읽기](../concepts/web-server-load.md)

## 갱신한 문서

- [ComfyUI 워크플로 등록](../concepts/comfyui-workflow-registration.md): 선택창에 H3가 안 보이던 미해결 항목을 PR #47 해결로 갱신하고 "First frame" 라벨은 표시만 남은 항목으로 정리
- [ComfyUI 생성물의 화면 비율](../concepts/comfyui-output-aspect.md): H3 영상 864x480과 흰 줄 절 추가
- [개념 색인](../concepts/index.md)

## 확인하지 못한 것

PR #48(진행률)과 #50(말투 지침)의 실제 효과는 새 생성으로 확인하지 못했다. 이미 만든 영상의 말투와 흰 줄은 그대로다.

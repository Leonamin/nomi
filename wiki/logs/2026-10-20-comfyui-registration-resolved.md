---
type: Log
title: "ComfyUI 등록 사고 수정·복구와 화면 비율 확인 반영"
description: "PR #42·#44·#45 병합과 실서버 확인 결과를 위키에 반영"
timestamp: 2026-10-20
okf_version: "0.1"
---

# ComfyUI 등록 사고 수정·복구와 화면 비율 확인 반영

앞서 진행 중으로 적어 둔 두 문서를 병합·배포·실서버 확인 결과로 갱신했다. 삭제 사고는 PR #44로, 세션 누수로 인한 덮어쓰기는 PR #45로 막았고 Wan2.2·Klein·Qwen·FL2VA를 복구했다. 화면 비율은 PR #42가 API 형식 Qwen에서 16:9(1360x768)와 9:16(768x1360)으로 확인됐다. 영상 워크플로의 새 비율 반영, MiniMax H3 선택창 문제는 확인하지 못했다고 문서에 남겼다.

- 갱신: concepts/comfyui-workflow-registration.md, concepts/comfyui-output-aspect.md, logs/index.md
- 추가: logs/2026-10-20-comfyui-registration-resolved.md

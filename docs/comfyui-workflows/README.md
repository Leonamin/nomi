# 참조 이미지를 받는 ComfyUI 워크플로 (캐릭터 일관성용)

ComfyUI "Save (API Format)" JSON이다. 설정 > ComfyUI > 워크플로 가져오기에서 그대로 올리면 가져오기 분석기가
`LoadImage`를 참조 슬롯(`first_frame_url`)으로, `Positive Prompt` 노드를 프롬프트로 자동 인식한다.
(분석기 결과: Klein = `image_edit`, Wan = `image_to_video`; 스모크 확인은 PR 본문 참조.)

| 파일 | 종류 | 사용 모델 파일 (ComfyUI 호스트에 있어야 함) |
| --- | --- | --- |
| `flux2-klein-reference-edit.api.json` | image_edit (참조 인물 유지 + 새 장면) | flux-2-klein-9b-fp8, qwen_3_8b_fp8mixed(type flux2), flux2-vae |
| `wan22-i2v.api.json` | image_to_video (정지 이미지 -> 영상) | wan2.2_i2v high/low 14B fp8, umt5_xxl_fp8, wan_2.1_vae, lightx2v 4-step LoRA 2종 |

가져온 뒤 에이전트는 `list_models`의 `accepts.image`가 true인 이 모델을 골라 `draft_shots`의 `references`
(`role: "first_frame"`, 에셋 id는 `look_at_media`)로 앵커 이미지를 넘긴다. 참조가 안 되는 모델이면 거절한다.

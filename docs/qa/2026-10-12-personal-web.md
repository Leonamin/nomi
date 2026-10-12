# Nomi 개인용 웹 — 실제 검증 기록

2026-10-12, 구현선 `nomi-web-implementation`. 기능 검증 커밋 `68939ab8d7d2fb1ae6f662a9571ae9f9d1b69602`. 이후 검증 기록 커밋은 문서와 배포 헬퍼 boolean 매개변수의 이름만 변경하며 실행 동작을 변경하지 않는다. 합입·CI 수령은 PR #1과 merge SHA의 delivery receipt가 별도 증거다.

## 실제 환경과 범위

Mac Chromium 실제 React UI → hamsbox Node 24/user systemd → 별도 19188 SSH 터널 → leo ComfyUI 0.38/RTX 5080. 접속은 Tailscale HTTPS 8445이며 noVNC를 사용하지 않는다. 검증 workflow는 기존 검증된 H3 수동 비디오 선언을 새 웹 catalog에 별도로 등록했다. 일반 생성은 640×384, 124프레임, 24fps, 20 steps. 실제 생성 4건에 결제 API/TTS/자동 재생성 요청은 없었다.

증거 원본은 Mac `/Users/leonamin/.codex/qa/nomi-web/2026-10-12/`에 있다. 큰 미디어와 브라우저 녹음은 공개 Git에 올리지 않았다. 운영 데이터는 `/home/leonamin/nomi-web-data`이다.

## GPU 생성 및 복구

모든 요청은 실제 브라우저의 수동 생성/재생성 버튼으로 제출했다.

| 요청 | 실제 ComfyUI prompt ID | 확인 |
|---|---|---|
| 빨간 컵·빗소리 | `2cfb1adb-669f-4db8-8f91-864471d7cf92` | 실행 중 브라우저 종료, 서버가 완료·미디어 저장, 재접속 복원 |
| 숲의 폭포·물소리 | `3ad3fd61-7386-4933-bfeb-339b7cb501f2` | 다른 샷의 실제 영상·오디오 생성, 약 103초 |
| 파란 컵·빗소리 | `a9f13430-3e3f-41ed-b272-1cff303c9be1` | 수락 후 웹 서비스 재시작, 같은 prompt ID 수집 계속, 이전 후보 보존 |
| 짧은 초록 컵 | `696760a9-d52f-42fd-bae8-e1c47e90333b` | 입력 52프레임, 실제 56프레임/2.333초 결과로 짧은 후보 교체 거절 검증 |

첫 생성은 약 105초였다. 생성 중 닫힌 브라우저 없이 서버의 영속 job receipt와 프로젝트 결과가 성공으로 바뀌었다. 서비스 재시작한 세 번째 생성은 재제출하지 않았다. `gpu-1-completed-while-closed.json`, `gpu-3-restored-after-server-restart.png`와 서버 작업 파일이 근거다.

## 후보와 타임라인

두 샷을 실제 UI에서 순서대로 배치했다. 첫 컷을 15프레임 왼쪽 트림하고 볼륨을 -6dB로 수정했다. 타임라인은 30fps, 총 310프레임이다. 첫 15프레임은 의도적인 빈 구간이다.

- 재생성과 이전/새 후보 선택으로 기존 컷의 source, ID와 순서가 바뀌지 않았다. 이 증거 구간 사이에 사용자가 볼륨 -6dB와 15프레임 트림을 직접 편집했으므로 모든 중간 snapshot의 tracks 전체가 동일하다고 주장하지 않는다. 파란 후보를 선택한 상태에서도 교체 버튼을 누르기 전 타임라인 source는 이전 빨간 컵이었다.
- 별도 Replace shot으로 첫 컷을 파란 컵으로 바꾼 뒤 source/thumbnail만 달라졌다. clip ID, 샷 순서, start/end, trim, 볼륨, 두 번째 컷은 동일했다.
- 2.333초 후보의 교체는 명확한 메시지와 함께 거절했다. 실패 전후 tracks가 동일했다. 최종 팝업에서 중문·영문 메시지를 직접 확인했다.
- 최종 선택은 파란 컵으로 복원했다. 생성 프롬프트와 입력 길이도 파란 컵/124프레임으로 돌려 놓았다.

근거: `candidate-old-selection.json`, `candidate-new-selection-before-replace.json`, `timeline-trimmed-before-replacement.json`, `timeline-after-replacement.json`, `short-candidate-before-replace.json`, `short-candidate-after-rejected-replace.json`, `final-project.json`.

## 전체 미리보기와 MP4 대조

브라우저에서 전체 10.333초를 실제로 재생했다. HTML video의 source 전환은 파란 컵 → 폭포, 첫 컷 volume 0.501187(-6dB) → 두 번째 컷 1이었다. 같은 원본 asset을 preview와 서버 FFmpeg가 사용했다. 실제 미리보기 오디오를 Web Audio/MediaRecorder로 녹음했으며 RMS 0.022896으로 무음이 아니다. 앱 상태/미디어를 mock으로 대체하지 않았다.

| 항목 | 측정 |
|---|---|
| MP4 | H.264 1920×1080, 30fps, 310프레임, 10.333333초 |
| 오디오 | AAC 32kHz stereo, 10.334초, 평균 -32.096dB, 최대 -16.845dB |
| 첫 컷 PCM 대조 | source trim/-6dB와 MP4 상관 0.988427, RMS 비율 0.996338 |
| 두 번째 컷 PCM 대조 | 코덱 지연 11 samples(0.344ms) 정렬 후 상관 0.998921, RMS 비율 0.997365 |
| 실제 녹음된 preview | 원본 대비 상관 0.930724/0.985351, RMS 비율 0.999706/0.995085 |
| 파란 컵 프레임 | 실제 browser frame과 export frame 36: RGB 평균 오차 2.364/255, PSNR 37.70dB |
| 폭포 프레임 | 실제 browser frame과 export frame 192: RGB 평균 오차 2.815/255, PSNR 36.25dB |

영상은 source 24fps → export 30fps와 H.264 재인코딩 때문에 바이트 동일성을 기대하지 않는다. 화면의 contain 영역을 source 크기로 비교했다. 오디오는 AAC/Opus 지연을 고려해 샷별 정렬한 수치다. 초기 무정렬 전체 파형 상관은 0.802752이므로 이를 샘플 단위 무손실 일치로 표현하지 않는다. 브라우저 초기 디코딩/경계 전환에는 수십 ms의 지연이 관찰됐다. 폭포의 정지 프레임 확인은 readyState 4, 오류 없음, 누적 33개 프레임 중 dropped 0이었다. 전체 재생의 dropped frame 수는 해당 기록이 없으므로 주장하지 않는다.

근거: `preview-playback-trace.json`, `preview-waterfall-frame.json`, `audio-comparison.json`, `video-comparison.json`, `media/preview-audio.webm`, `media/final.mp4` 및 실제 browser/export PNG 쌍. 모든 비교 PNG를 구현선에서 직접 열어 확인했다.

## 내보내기 중 탭 종료와 재접속

첫 export `25627ab4-f8f8-4ad9-9d74-d081c7472e99`는 1.821초에 성공했다. 두 번째 export `ad3d95a3-9948-4b96-93a6-8a23a576f877`는 버튼 직후 브라우저를 닫았고 서버에서 1.677초에 완료됐다. 재접속한 Tasks의 View output 버튼으로 실제 MP4를 다운로드했다. 두 결과는 모두 2,966,814 bytes이며 SHA-256은 `1d1ff44793b67b1402ef5d0f242149ed74c05fb4d3291cac71552a06c045ef5b`로 같다. 완료 이후 웹 서비스 재배포에서도 프로젝트·후보·편집·완료 export가 보존됐다.

근거: `export-reconnect-evidence.json`, `export-jobs.jsonl`, `media/reconnected-export.mp4`. 진행 중 FFmpeg 자체의 서비스 재시작은 안전 재개를 약속하지 않는다. 기존 Nomi export manager가 중단 실패로 회수하고 사용자가 새 내보내기를 시작한다.

완전히 닫힌 Chromium을 새로 시작한 프로젝트 복원은 브라우저 기동을 포함해 2.03초에 생성 화면이 표시됐다(`cold-reconnect-time.json`). 원래 Nomi의 프로젝트 로드 흐름에 따라 생성 화면으로 열리며 마지막 작업 탭까지 복원하는 기능은 추가하지 않았다. 프로젝트·현재 후보·타임라인·작업 기록은 서버 원본에서 복원된다.

## UI·운영 보존

실제 zh/en 1600×1100 및 960×800에서 preview와 생성·후보 UI를 확인했다. 작은 폭에서는 기존 캔버스의 Fit view/이동으로 샷에 접근한다. Prompt library도 실제 builtin 항목을 로드했다. About의 Source code/AGPL 링크, `/source`의 실행 SHA와 LICENSE 응답을 확인했다. 없는 토큰/다른 Origin은 403, private profile 미디어 경로는 404로 거절했다.

기존 Nomi app은 처음과 끝 모두 inactive였다. 기존 ComfyUI tunnel/web/results의 PID는 각각 2429581/2429587/2432104로 변하지 않았다. 원래 모델 catalog SHA-256 `60c798099b2e6f194d16ad385e49b60df17226dc1bfc3ede23982a3076eeda61`도 변하지 않았다. 기존 Nomi source checkout은 clean, Tailscale 기존 443/8443/8444 대상은 그대로이고 8445만 추가했다. leo 모델/서비스 설정은 변경하지 않았다. 모든 배포는 commit → push → hamsbox fetch → clean release 순서였으며 dirty checkout을 정리하지 않았다.

근거: `hamsbox-before-deploy.txt`, `hamsbox-after-deploy.txt`, `final-short-rejected-en.png`, `final-short-rejected-zh.png`, `final-preview-en.png`, `final-preview-zh.png`, `final-preview-narrow-en.png`, `final-preview-narrow-zh.png`.

## 검사와 제한

Mac 전체 테스트 1,677파일/15,966 pass, expected failure 2, skipped 4. 기능 검증 SHA의 hosted Linux Unit은 1,679파일/15,961 pass, expected failure 2, skipped 13이었다(플랫폼별 검사 차이). 실제 Electron core smoke 4/4와 desktop build 통과. 최종 web 17테스트, web 타입, 원래 4종 typecheck, prompt/후보 관련 11테스트 통과. 계약/i18n/공용 control/쓰기 경계/prior-art/self-written/비밀키 검사도 통과했다. 최종 hosted CI 결과는 해당 PR의 exact head check를 사용한다.

상속된 로컬 design-lab 시각 실패 152개만 사용자 승인 예외다. 깨끗한 v0.23.1과 동일한 실패 목록, 정적 비교 이미지 143개 동일, 대표 차이 416픽셀을 보존했다. baseline PNG/기존 UI를 바꾸지 않았고 이 검사를 통과로 기록하지 않는다. CI·웹 검사·실제 GPU에는 예외가 없다.

Windows 실제 웹 브라우저, 모바일 편집, 대규모 32×1080p/1000샷, 서버 전체 재부팅, 모든 데스크톱 부가기능은 unverified다. TTS·AI 자동 검수/재생성·결제·다중 사용자 SaaS는 제공 범위 밖이다. 생성 UI에서 실행한 4건과 일반 FFmpeg 영상·오디오 타임라인이 이번 완료 판정 대상이다.

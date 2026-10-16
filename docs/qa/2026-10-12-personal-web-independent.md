# Nomi 개인용 웹 — 독립 인수 검수

2026-10-12. 인수선 `nomi-web-acceptance`, 구현선 `nomi-web-implementation`과 분리.

대상 기능 SHA: `68939ab8d7d2fb1ae6f662a9571ae9f9d1b69602`. 로컬 HEAD를 직접 확인했다. 검수 시작 당시 dirty 변경은 설계 문서와 구현선 QA 보고서뿐이었다. 이 인수선은 소스·운영 상태를 변경하지 않았고 추가 GPU 요청도 제출하지 않았다. 본 보고서만 작성했다.

최종 후속 diff도 확인했다. 기능 SHA 이후 문서 변경 외에 `scripts/web/deploy-hamsbox.mjs`의 Boolean 매개변수 `capture`와 같은 분기 참조를 `shouldCaptureOutput`으로 바꾼 한 줄 rename이 있다. 기본값·인수 순서·stdio 분기는 동일하며 배포 및 런타임 동작 변경이 없으므로 기능 인수 PASS를 유지한다.

**판정: 요청한 개인용 수동 제작 흐름의 코드·실제 증거 인수 PASS. 새로 재현 가능한 기능 결함은 발견하지 않았다.** 이는 hosted CI, PR 병합 또는 merge SHA의 `delivery:verify-merged` 완료 판정과 별개다. 해당 수령은 조정선에서 확인해야 한다.

## 검수 방식과 경계

고정 커밋의 웹 transport, 프로젝트 쓰기 경계, 서버 생성 작업, 브라우저 복원, 후보 교체 및 서버 export 경계를 읽었다. 이전 독립 검토에서 지적한 항목의 수정도 재확인했다. `bd98cb6227786797870e3a28a0e0cd0dc296af71` 이후 변경인 inline 미디어 가져오기, 웹 prompt library의 native skill 조회 제외, 후보 팝업 내부 피드백을 별도로 검토했다.

실제 검증은 구현선이 실행·기록한 원본 파일을 독립적으로 읽고 미디어를 다시 분석했다. 인수선이 브라우저 전체 흐름이나 GPU 작업을 별도로 재실행한 것은 아니다. 증거 루트는 `/Users/leonamin/.codex/qa/nomi-web/2026-10-12/`이며 아래 파일명은 이 루트 기준이다. 구현선 설명만으로 PASS를 정하지 않고 JSON 원본, 실제 screenshot, 다운로드한 MP4와 브라우저 녹음에 근거했다.

독립 실행한 검사:

- `pnpm run test:web`: 7파일, 17테스트 PASS.
- `pnpm exec tsc -p tsconfig.web.json`: exit 0.
- `ffprobe`로 최종 MP4의 스트림·길이·프레임 수 확인.
- `ffmpeg -v error -i media/final.mp4 -f null -`: exit 0, 디코딩 오류 없음.
- 원본 MP4/브라우저 녹음 PCM 및 export 프레임을 다시 디코딩해 수치 대조.

전체 기존 테스트·Electron smoke·다른 4종 typecheck는 구현선의 검사 증거를 검토한 범위다. 독립 인수선에서 전체를 반복 실행했다고 주장하지 않는다.

## 서버 상태와 복원

| 경계 | 확인 내용 | 원본 증거 |
|---|---|---|
| GPU 생성 | 실제 prompt ID 4개 모두 `resultStatus=succeeded`. 빨간 컵·폭포·파란 컵은 각 5.167초, 짧은 초록 컵은 2.333333초 | `gpu-job-summary.json`, `final-project.json` |
| 탭 종료 | 첫 빨간 컵 작업의 receipt와 ComfyUI 실행 성공/프로젝트 결과가 닫힌 브라우저 구간에 보존됨 | `gpu-1-completed-while-closed.json`, `gpu-1-running-before-close.png` |
| 웹 서비스 재시작 | 파란 컵의 기존 prompt ID `a9f13430-3e3f-41ed-b272-1cff303c9be1`로 결과 수집. 재시작 전후 UI와 최종 성공 후보 확인 | `gpu-3-before-server-restart.png`, `gpu-3-restored-after-server-restart.png`, `gpu-job-summary.json` |
| 최종 서비스 | 별도 `nomi-web.service`/`nomi-web-comfyui.service` active·enabled, 실행 release가 대상 SHA | `new-service-and-gpu.txt` |
| 완료 export 복원 | 완료 작업 두 건과 결과 경로가 남아 있고 최종 release 재접속 다운로드도 같은 MP4 | `export-reconnect-evidence.json`, `media/final-release-restored.mp4` |

`cold-reconnect-time.json`은 닫힌 Chromium의 새 실행을 포함한 Generation workspace 표시 시간을 2.025초로 기록한다. 프로젝트는 기존 Nomi의 로드 동작에 따라 Generate에서 열리며 직전 Preview 모드 자체까지 복원하지는 않는다. 후보·편집·작업·산출물 복원과 화면 모드 복원을 구분한다.

코드에서 작업 receipt는 웹 데이터 루트의 파일에 보존되고 브라우저 surface 수명과 분리된다. receipt가 있는 작업은 재시작 시 이어 조회하며, 수락 여부를 잃은 제출은 오류로 표시하고 자동 재제출하지 않는다. 프로젝트 저장과 결과 전달은 프로젝트별 쓰기 직렬화 경계를 공유한다.

이전 지적한 결과 envelope, 수동 생성 grant, stale 저장의 서버 실패/완료 덮어쓰기, targeted cancel, reconnect 상태 복원, 첫 run 보존, 실패 snapshot skip, surface 누수의 수정이 유지된다. surface는 SSE 연결에 따라 임대·만료되고 작업은 별도로 남는다. 브라우저 미디어는 같은 origin의 절대 URL로 전송되며 서버 저장에서는 canonical `nomi-local://asset/…` 참조로 되돌린다. 새 inline 가져오기는 기존 자산 저장 소유자를 사용하고 임의 HTTP URL을 거절한다. prompt library의 웹 옵션은 native skill 실행 없이 builtin을 제공하고 데스크톱 기본값은 유지한다.

## 후보·타임라인 인수

승인 샘플의 후보 선택과 별도 교체 버튼 의미를 실제 zh/en 후보 팝업 및 프로젝트 JSON과 대조했다.

- 파란 후보가 노드에 선택된 상태에서도 명시적 교체 전 타임라인은 빨간 컵 source를 유지했다. 후보 선택이 노드만 바꾼다는 승인 동작과 맞는다.
- `timeline-trimmed-before-replacement.json`과 `timeline-after-replacement.json`의 첫 컷에서 달라진 필드는 `url`, `thumbnailUrl`뿐이다. clip ID, 순서, start/end, source in, duration, audio와 나머지 필드는 그대로이고 두 번째 컷은 모든 필드가 같다.
- `short-candidate-before-replace.json`의 tracks와 `short-candidate-after-rejected-replace.json`의 tracks는 strict equality다. 2.333초 후보는 기존 in-point/길이에 부족하므로 전체 교체를 거절했다. 실제 영문·중문 팝업 안에 사유와 타임라인 유지 안내가 보인다.
- `final-project.json`의 tracks는 교체 후 tracks와 같다. 최종 노드 선택은 파란 컵, 생성 길이는 124프레임으로 복원되어 있다. 이전·짧은 후보도 이력에 남는다.

재생성/후보 선택 관련 중간 파일 사이에는 사용자가 -6dB 볼륨과 15프레임 트림을 직접 편집했다. 따라서 모든 중간 tracks가 동일했다는 주장은 하지 않는다. 원본이 증명하는 보존 범위는 해당 구간의 source·ID·순서, 명시적 교체 전후의 source-only 변경, 짧은 후보 거절 전후의 전체 tracks 동일성이다.

근거: `candidate-old-selection.json`, `candidate-new-selection-before-replace.json`, 위 timeline/short JSON, `final-short-rejected-en.png`, `final-short-rejected-zh.png`, 승인 `candidate-sample-en.png`/`candidate-sample-zh.png`. screenshot은 인수선에서 직접 열어 확인했다.

## 실제 preview·MP4 인수

최종 타임라인은 30fps, 310프레임이다. 처음 15프레임은 의도적인 빈 구간이며 첫 컷은 15→155, 두 번째는 155→310이다. 첫 source in은 15프레임, gain은 -6dB다. 실제 브라우저 재생 trace 108개 이벤트에서 파란 컵 → 폭포 source 순서, volume 0.501187 → 1, 종료 시점 약 10.393초를 확인했고 media error 이벤트는 없다.

| 직접 재측정 | 결과 |
|---|---|
| 최종 MP4 영상 | H.264, 1920×1080, 30fps, 310프레임, 10.333333초 |
| 최종 MP4 오디오 | AAC, 32kHz stereo, 10.334초, PCM RMS 0.024839 |
| 실제 preview 녹음 | `media/preview-audio.webm`, PCM RMS 0.022896, 비무음 |
| 첫 컷 오디오 | source trim 및 -6dB 적용 후 MP4와 상관 0.988600, RMS 비율 0.996616 |
| 두 번째 컷 오디오 | 11 samples(0.344ms) 정렬 후 상관 0.998873, RMS 비율 0.997425 |
| 파란 컵 영상 | 실제 browser PNG ↔ MP4 frame 36: RGB MAE 2.364/255, PSNR 37.700dB |
| 폭포 영상 | 실제 browser PNG ↔ MP4 frame 192: RGB MAE 2.815/255, PSNR 36.249dB |

프레임 비교는 MP4의 중앙 contain 영역(1800×1080)을 source 크기 640×384로 변환했다. `media/preview-source-0.png`/`media/final-frame-36.png`, `media/preview-waterfall.png`/`media/final-frame-192.png`를 직접 열어 장면·순서를 확인했고 재측정 수치도 저장된 `video-comparison.json`과 일치한다. 오디오 측정은 원본 source와 최종 MP4를 FFmpeg로 mono float32/32kHz 디코딩해 수행했다. 저장된 `audio-comparison.json`의 실제 preview/source 파형 대조도 함께 검토했다.

`media/final.mp4`, `media/reconnected-export.mp4`, `media/final-release-restored.mp4`를 직접 해시했다. 모두 2,966,814 bytes, SHA-256 `1d1ff44793b67b1402ef5d0f242149ed74c05fb4d3291cac71552a06c045ef5b`다. 탭 종료 후 완료된 export와 최종 서비스 재접속 다운로드가 동일 산출물을 제공한다.

영상·오디오·순서·트림·볼륨의 의미상 일치는 확인했다. H.264/AAC/Opus 재인코딩과 브라우저 시작·경계 디코딩 지연이 있어 무손실 또는 sample-exact 일치로 판정하지 않는다. 첫 빈 구간의 경계 부근에도 작은 잔여 PCM이 측정되므로 디지털 완전 무음이라고 주장하지 않는다. dropped 0/33은 폭포 정지 프레임 확인에 해당하며 전체 재생의 dropped frame 수를 증명하지 않는다.

## UI·기존 운영 보존

인수선은 실제 `final-preview-en.png`/`final-preview-zh.png`, `final-preview-narrow-en.png`/`final-preview-narrow-zh.png`, `final-generation-narrow-en.png`와 후보 거절 zh/en 화면을 직접 열었다. 기존 Nomi의 프로젝트 → 제작 → 생성 → preview 흐름과 타임라인을 유지하며 1600×1100 및 960×800 증거가 있다. 좁은 생성 화면의 캔버스는 이동/Fit view를 사용하는 기존 방식이다. 모바일 적합성까지 확인한 것은 아니다.

기존 운영의 before/after 파일에서 Nomi app inactive, ComfyUI tunnel/web/results PID 2429581/2429587/2432104 및 기존 catalog SHA-256이 같다. Tailscale 443→8765, 8443→6081, 8444→9021도 같고 새 8445→9031만 추가됐다. 웹 데이터 루트는 `/home/leonamin/nomi-web-data`, 새 터널은 19188이고 기존 18188 서비스 수명에 의존하지 않는다. LICENSE는 기준 커밋과 동일하며 웹 `/source`는 build SHA의 공개 소스로 연결한다.

이 보존 판정은 기록된 서비스·설정 증거와 코드 경계에 근거한다. 기존 Japonica/Nomi/leo의 모든 파일을 독립적으로 해시해 비교했다고 확대하지 않는다.

## 범위 제한과 후속 수령

- 탭 종료 후 생성·export 지속, 수락한 생성의 웹 서비스 재시작 복구, 완료 결과 재접속은 인수 범위다. 진행 중 FFmpeg의 웹 서비스 재시작은 기존 작업 회수 후 실패/명시적 재시도를 사용하며 seamless resume는 제공하지 않는다.
- 실제 GPU 4건, 일반 영상·오디오 두 컷과 명시적 후보 교체가 검증 범위다. Windows 실제 브라우저, 모바일 편집, 32개 1080p/1000샷, 전체 서버 재부팅 및 모든 데스크톱 부가기능은 unverified다.
- TTS, AI 자동 검수·재생성, 결제, 다중 사용자 SaaS는 승인 범위 밖이다.
- 상속된 design-lab 실패는 baseline/branch 각 152개, 동일 실패 이름 및 정적 diff 이미지 143개 동일의 기록이다. 승인된 advisory failure이며 green 검사로 바꾸지 않는다.
- 기능·증거 인수 PASS와 CI/PR/merge receipt를 분리한다. 본 보고서 시점의 hosted CI 전체 성공과 병합은 독립 인수선에서 확인하지 않았다. 조정선이 exact head CI와 merge SHA 수령을 완료하기 전 저장소 규칙의 ‘已解决’ 상태로 확대하지 않는다.

관련 문서: [설계·검증 계획](../archive/plan/2026-10-12-personal-web.md), [구현선 실제 검증 기록](2026-10-12-personal-web.md).

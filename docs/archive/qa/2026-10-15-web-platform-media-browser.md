# Web platform media browser acceptance — 2026-10-15

Acceptance line: coordinator-browser (independent from `sol_implementation`).

Environment: Chromium via agent-browser 0.34.0, browser on macOS, Node Web server on hamsbox. Preview used a dedicated copy of production projects/profile/jobs at `/tmp/nomi-handoff-acceptance-data`, port 9032 forwarded to local 19032. Tests did not regenerate paid media or change the live project. Production baseline was inspected read-only.

## Observed results

- Baseline live project `project-1792039532853-rtp2qv`: two empty canvas cards. Task notification image used `nomi-local://asset/.../image-1792047217719-3e383eae6e8f9a9b3698b823.png`, `complete=true`, `naturalWidth=0`. Capture: `nomi-before.png`.
- Preview with repair: the matching generated result appears in its canvas card and task notification. Both load the same `/api/media/` project asset and have `naturalWidth=1024`. The intentionally empty other card remains empty. Captures inspected directly: `nomi-after-ko.png`, `nomi-after-en.png`, `nomi-after-zh.png`.
- Browser refresh preserves the recovered generated result. This verifies recovery from existing persisted run/history data without another generation.
- Existing generated production video `project-1791805131553-nwbyhm/assets/generated/2026-10-13/video-1791885345807.mp4` opens from the asset library, decodes at 640×384, duration 5.167s, readyState 4, and `play()` succeeds. Capture inspected directly: `nomi-video-zh.png`.
- Video HEAD returns 200, `video/mp4`, 653643 bytes. Byte range 0–1023 returns 206 with `Content-Range: bytes 0-1023/653643` and 1024 bytes.
- Existing generated image download returns 200, `image/png`, 1842406 bytes, and attachment filename header.
- Actual asset-library drop handler accepts a browser `File` made from the real generated PNG. `/api/upload` returns 200. `handoff-drop-acceptance.png` is saved in the copied project's assets, displayed at naturalWidth 1024, and survives browser refresh. Capture: `nomi-drop-zh.png`. Only copied acceptance data was written.
- Final rebuilt Web UI recheck: the unsupported Skills rail and trace-directory action are absent; global screenshot hotkey, project-location change/reveal and native sound preview/replace are disabled; AI policy controls are disabled. Supported sound preferences still load. Switching settings tabs and closing the dialog leaves the app working. Final Chinese and English settings captures were inspected directly: `nomi-settings-final-zh.png`, `nomi-settings-final-en.png`.

## Limits

No new ComfyUI generation, Windows/Electron run, full timeline export, standalone audio playback, or largest-canvas performance test was performed. These observations do not establish GitHub CI success or production deployment. Synthetic fixtures are not used as evidence of production video decoding.

## Capture location

Captures are local task artifacts beside this report in the Codex visualization directory. They were visually inspected by the coordinator. The repository's independent code review report records static review and focused tests separately.

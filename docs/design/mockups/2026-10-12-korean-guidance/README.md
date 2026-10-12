# 한국어 문구 검토 샘플

프로젝트 시작 화면, 언어 설정, 학생용 안내의 문구를 검토한다. 앱 기능이나 한국어 지원을 구현한 화면은 아니다. 영어·중국어 사전은 변경하지 않았다.

저장소 루트에서 다음 명령으로 기존 Tailwind 토큰을 사용하는 샘플 CSS를 만든다. 결과는 Git에서 제외되는 `.tmp/`에 저장한다.

```sh
pnpm exec tailwindcss -i src/styles/index.css -o .tmp/korean-preview.css -c tailwind.config.ts --content docs/design/mockups/2026-10-12-korean-guidance/index.html --minify
python3 -m http.server 9133 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:9133/docs/design/mockups/2026-10-12-korean-guidance/index.html`을 연다. 언어 설정, 도움말, 새 프로젝트 버튼을 눌러 문구를 확인할 수 있다. 샘플에서 생성·저장·서버 설정 변경은 실행하지 않는다.

샘플 문구의 의미, 초보자에게 이해되는 정도, 긴 문장의 줄바꿈을 확인한다. 기존 배치를 기준으로 재구성했으며 새 제품 UI 제안은 아니다. 샘플의 안내 버튼은 검토 도구다. 실제 앱의 영상 데모 버튼과 도움말 진입 동작은 구현 단계에서 기존 역할을 유지한다.

한국어 앱 적용 전 승인 필요 조건은 `AGENTS.md`의 P5에 따른다. 승인 후 [설계 카드](../../../plan/2026-10-12-korean-guidance.md)의 전체 한국어 지원 작업을 진행한다.
